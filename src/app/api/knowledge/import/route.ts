import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import JSZip from "jszip";

// POST /api/knowledge/import — Import articles from a ZIP file (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryId = formData.get("categoryId") as string | null;
    const spaceId = formData.get("spaceId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не загружен" },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "categoryId обязателен" },
        { status: 400 }
      );
    }

    // Verify category exists
    const catCheck = await pool.query(
      `SELECT id FROM categories WHERE id = $1`,
      [categoryId]
    );
    if (catCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Категория не найдена" },
        { status: 404 }
      );
    }

    // If spaceId provided, verify it exists
    if (spaceId) {
      const spaceCheck = await pool.query(
        `SELECT id FROM knowledge_spaces WHERE id = $1`,
        [spaceId]
      );
      if (spaceCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Пространство знаний не найдено" },
          { status: 404 }
        );
      }
    }

    // Read ZIP file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract ZIP using JSZip
    const zip = await JSZip.loadAsync(buffer);

    // Build a map of folder -> files
    // ZIP structure: each folder = a topic, containing video, PDF, PPTX, and optionally README.md
    const folderMap: Record<string, { video?: string; pdf?: string; pptx?: string; readme?: string }> = {};

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      // Normalize path separators
      const normalizedPath = relativePath.replace(/\\/g, "/");
      const parts = normalizedPath.split("/");

      // If the file is at the root level (no folder), skip it
      if (parts.length < 2) continue;

      const folderName = parts[0];
      const fileName = parts[parts.length - 1];
      const ext = fileName.split(".").pop()?.toLowerCase() || "";

      if (!folderMap[folderName]) {
        folderMap[folderName] = {};
      }

      if (ext === "mp4" || ext === "webm") {
        folderMap[folderName].video = fileName;
      } else if (ext === "pdf") {
        folderMap[folderName].pdf = fileName;
      } else if (ext === "pptx") {
        folderMap[folderName].pptx = fileName;
      } else if (fileName.toLowerCase() === "readme.md") {
        folderMap[folderName].readme = normalizedPath;
      }
    }

    const folderNames = Object.keys(folderMap);
    if (folderNames.length === 0) {
      return NextResponse.json(
        { error: "ZIP-файл не содержит папок с материалами" },
        { status: 400 }
      );
    }

    const authorId = (session.user as Record<string, unknown>).id as string;
    const createdArticles: Record<string, unknown>[] = [];
    const createdQueueEntries: Record<string, unknown>[] = [];

    for (const folderName of folderNames) {
      const files = folderMap[folderName];

      // Generate slug from folder name
      const slug = folderName
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 80);

      // Check slug uniqueness — append suffix if needed
      let finalSlug = slug;
      let slugSuffix = 1;
      let slugExists = true;
      while (slugExists) {
        const existing = await pool.query(
          `SELECT id FROM articles WHERE slug = $1`,
          [finalSlug]
        );
        slugExists = existing.rows.length > 0;
        if (slugExists) {
          slugSuffix++;
          finalSlug = `${slug}-${slugSuffix}`;
        }
      }

      // Read README.md content if present
      let content = "";
      if (files.readme) {
        const readmeEntry = zip.file(files.readme);
        if (readmeEntry) {
          content = await readmeEntry.async("string");
        }
      }

      // Build inputData for processing queue
      const inputData: Record<string, string> = { folderName };
      if (files.video) inputData.video = files.video;
      if (files.pdf) inputData.pdf = files.pdf;
      if (files.pptx) inputData.pptx = files.pptx;

      // Create article
      const articleId = genId("art_");
      const articleResult = await pool.query(
        `INSERT INTO articles (id, title, slug, content, "categoryId", "authorId", "isPublished", status, "videoUrl", "pdfUrl", "pptxUrl", "viewCount", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, false, 'pending', $7, $8, $9, 0, NOW(), NOW())
         RETURNING *`,
        [
          articleId,
          folderName,
          finalSlug,
          content,
          categoryId,
          authorId,
          files.video || null,
          files.pdf || null,
          files.pptx || null,
        ]
      );

      createdArticles.push(articleResult.rows[0]);

      // Create processing queue entry
      const queueId = genId("pq_");
      const queueResult = await pool.query(
        `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
         VALUES ($1, 'zip_import', 'pending', $2, $3, 0, NOW(), NOW())
         RETURNING *`,
        [
          queueId,
          articleId,
          JSON.stringify(inputData),
        ]
      );

      createdQueueEntries.push(queueResult.rows[0]);
    }

    return NextResponse.json(
      {
        message: `Импортировано ${createdArticles.length} статей из ZIP-файла`,
        articles: createdArticles,
        queue: createdQueueEntries,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing ZIP:", error);
    return NextResponse.json(
      { error: "Ошибка импорта ZIP-файла" },
      { status: 500 }
    );
  }
}
