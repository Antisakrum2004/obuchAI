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
export const maxDuration = 60; // Allow up to 60s for file uploads

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
 *
 * spaceId is required. categoryId is optional (legacy, ignored if spaceId provided).
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
    const spaceId = (formData.get("spaceId") as string) || null;
    const categoryId = (formData.get("categoryId") as string) || null; // legacy
    const autoProcess = formData.get("autoProcess") === "true";
    const autoCategorize = formData.get("autoCategorize") === "true";

    // Resolve spaceId: prefer explicit, fallback to categoryId -> category.spaceId
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId && categoryId) {
      try {
        const catResult = await pool.query(
          `SELECT "spaceId" FROM categories WHERE id = $1`,
          [categoryId]
        );
        if (catResult.rows.length > 0) {
          resolvedSpaceId = catResult.rows[0].spaceId;
        }
      } catch {
        // categories table may not exist, ignore
      }
    }

    if (!resolvedSpaceId) {
      return NextResponse.json(
        { error: "spaceId обязателен" },
        { status: 400 }
      );
    }

    // Verify space exists
    const spaceResult = await pool.query(
      `SELECT id FROM knowledge_spaces WHERE id = $1`,
      [resolvedSpaceId]
    );
    if (spaceResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Раздел знаний не найден" },
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
      spaceId: string;
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

        // Create article with spaceId
        await pool.query(
          `INSERT INTO articles (
            id, title, slug, content, summary, "spaceId",
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
            resolvedSpaceId,
            false,
            "pending",
            "direct",
            "",
          ]
        );

        // Upload file to storage (with fallback)
        let fileUrl = "";
        let fileKey: string | null = null;
        try {
          const storageKey = generateStorageKey("article", articleId, file.name);
          const uploadResult = await storageProvider.upload(
            storageKey,
            file.stream(),
            file.type
          );
          fileUrl = uploadResult.url;
          fileKey = uploadResult.key || null;
        } catch (storageErr) {
          console.warn(`[bulk-upload] Storage upload failed for ${file.name}:`, storageErr);
          // If storage is not configured, log a clear warning
          if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.S3_ENDPOINT) {
            console.warn(`[bulk-upload] No storage configured (BLOB_READ_WRITE_TOKEN / S3). File "${file.name}" will not be accessible for AI content extraction.`);
          }
        }

        // Update article with file URL (if upload succeeded)
        if (fileUrl) {
          await pool.query(
            `UPDATE articles SET "${articleField}" = $1 WHERE id = $2`,
            [fileUrl, articleId]
          );
        }

        // Create media record
        try {
          const mediaId = genId("med-");
          const userId = (session.user as Record<string, unknown>).id as string;
          await pool.query(
            `INSERT INTO media (
              id, "fileName", "fileType", "mimeType", "fileSize",
              url, "thumbnailUrl", duration, "articleId", "uploadedBy", "fileKey", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
            [
              mediaId,
              file.name,
              validation.fileType || "document",
              file.type,
              file.size,
              fileUrl || "",
              null,
              null,
              articleId,
              userId,
              fileKey,
            ]
          );
        } catch (mediaErr) {
          console.warn(`[bulk-upload] Media record failed for ${file.name}:`, mediaErr);
        }

        // Create processing queue entries
        // Only add content_extract if we actually have a PDF URL (storage upload succeeded)
        const hasPdfUrl = fileCategory === "pdf" && fileUrl;
        const queueTypes: string[] = [];
        if (hasPdfUrl) {
          queueTypes.push("content_extract");
        }
        queueTypes.push("ai_metadata");
        if (autoProcess) {
          queueTypes.push("glossary_extract");
        }

        for (const type of queueTypes) {
          try {
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
                JSON.stringify({
                  fileName: file.name,
                  fileCategory,
                  autoCategorize: autoCategorize || !categoryId,
                  spaceId: resolvedSpaceId,
                }),
                0,
              ]
            );
          } catch (queueErr) {
            console.warn(`[bulk-upload] Queue entry failed for ${file.name}/${type}:`, queueErr);
          }
        }

        results.push({
          id: articleId,
          title,
          slug,
          fileName: file.name,
          fileType: getFileIcon(validation.fileType || "document", file.type),
          status: "pending",
          spaceId: resolvedSpaceId,
        });
      } catch (fileErr) {
        console.error(`[bulk-upload] Error processing file ${file.name}:`, fileErr);
        const msg = fileErr instanceof Error ? fileErr.message : "Ошибка загрузки";
        errors.push({ fileName: file.name, error: msg });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: `Не удалось загрузить ни одного файла`,
        errors,
      }, { status: 500 });
    }

    const storageWarning = errors.some(e => e.error.includes("Storage") || e.error.includes("BLOB"))
      ? " Внимание: хранилище файлов не настроено (BLOB_READ_WRITE_TOKEN)." : "";

    return NextResponse.json({
      message: `Загружено ${results.length} из ${files.length} файлов.${storageWarning}`,
      articles: results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: results.length > 0 ? 201 : 500 });
  } catch (error) {
    console.error("[bulk-upload] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
