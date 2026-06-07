import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { storageProvider } from "@/lib/storage";
import { genId } from "@/lib/gen-id";
import {
  validateFile,
  generateStorageKey,
  getFileIcon,
} from "@/lib/media-utils";

export const dynamic = "force-dynamic";

// Supported file categories and what article field they map to
const FILE_FIELD_MAP: Record<string, string> = {
  pdf: "pdfUrl",
  pptx: "pptxUrl",
  video: "videoUrl",
  docx: "sourceUrl",
  image: "sourceUrl",
};

/**
 * POST /api/knowledge/bulk-upload
 * Bulk upload multiple files (PDF, PPTX, DOCX, video, images).
 * Each file becomes a separate article with the file attached.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userRole = (session.user as Record<string, unknown>)?.role;
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Недостаточно прав для загрузки файлов" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const categoryId = formData.get("categoryId") as string;
    const autoProcess = formData.get("autoProcess") === "true";

    if (!categoryId) {
      return NextResponse.json(
        { error: "Укажите категорию (categoryId)" },
        { status: 400 }
      );
    }

    // Verify category exists
    const catResult = await pool.query(
      `SELECT id, name FROM categories WHERE id = $1`,
      [categoryId]
    );
    if (catResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Категория не найдена" },
        { status: 404 }
      );
    }

    // Collect all files from formData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Нет файлов для загрузки" },
        { status: 400 }
      );
    }

    const results: Array<{
      id: string;
      title: string;
      slug: string;
      fileName: string;
      fileType: string;
      status: string;
    }> = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          errors.push({ fileName: file.name, error: validation.error || "Невалидный файл" });
          continue;
        }

        // Generate article title from filename
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        const title = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        const slug = baseName
          .toLowerCase()
          .replace(/[^a-zа-яё0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .substring(0, 80) + "-" + Date.now().toString(36);

        // Determine article field for this file type
        const articleId = genId("art-");
        const fileCategory = validation.category || "other";
        const articleField = FILE_FIELD_MAP[fileCategory] || "sourceUrl";

        // Create article with placeholder content
        await pool.query(
          `INSERT INTO articles (
            id, title, slug, content, summary, "categoryId",
            "isPublished", status, "sourceType",
            "${articleField}",
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            articleId,
            title,
            slug,
            `# ${title}\n\n*Содержимое будет добавлено после обработки.*`,
            `Загружен файл: ${file.name}`,
            categoryId,
            false,
            "pending",
            "direct",
            "",
          ]
        );

        // Upload file to storage
        const storageKey = generateStorageKey("article", articleId, file.name);
        const uploadResult = await storageProvider.upload(
          storageKey,
          file.stream(),
          file.type
        );

        // Update article with file URL
        await pool.query(
          `UPDATE articles SET "${articleField}" = $1 WHERE id = $2`,
          [uploadResult.url, articleId]
        );

        // Create media record
        const mediaId = genId("med-");
        const userId = (session.user as Record<string, unknown>).id as string;
        await pool.query(
          `INSERT INTO media (
            id, "fileName", "fileType", "mimeType", "fileSize",
            url, "thumbnailUrl", duration, "articleId", "uploadedBy", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            mediaId,
            file.name,
            validation.fileType || "document",
            file.type,
            uploadResult.size || file.size,
            uploadResult.url,
            null,
            null,
            articleId,
            userId,
          ]
        );

        // Create processing queue entries
        const queueTypes = ["ai_metadata"];
        if (autoProcess) {
          queueTypes.push("glossary_extract");
        }

        for (const type of queueTypes) {
          const queueId = genId("pq-");
          await pool.query(
            `INSERT INTO processing_queue (
              id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              queueId,
              type,
              "pending",
              articleId,
              JSON.stringify({ fileName: file.name, fileCategory }),
              0,
            ]
          );
        }

        results.push({
          id: articleId,
          title,
          slug,
          fileName: file.name,
          fileType: getFileIcon(validation.fileType || "document", file.type),
          status: "pending",
        });
      } catch (fileErr) {
        const msg = fileErr instanceof Error ? fileErr.message : "Ошибка загрузки";
        errors.push({ fileName: file.name, error: msg });
      }
    }

    return NextResponse.json({
      message: `Загружено ${results.length} из ${files.length} файлов`,
      articles: results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Bulk upload error:", error);
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
