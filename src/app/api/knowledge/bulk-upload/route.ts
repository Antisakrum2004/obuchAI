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
 * Ensure the articles table allows NULL categoryId.
 * This runs once and is a no-op if already nullable.
 */
async function ensureCategoryIdNullable() {
  try {
    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'articles' AND column_name = 'categoryId' AND is_nullable = 'NO') THEN
          ALTER TABLE articles ALTER COLUMN "categoryId" DROP NOT NULL;
        END IF;
      END $$;
    `);
  } catch (e) {
    console.warn("[bulk-upload] Could not alter categoryId nullable:", e);
  }
}

/**
 * POST /api/knowledge/bulk-upload
 * Bulk upload multiple files (PDF, PPTX, DOCX, video, images).
 * Each file becomes a separate article with the file attached.
 * Admin only.
 *
 * categoryId is optional — if not provided, AI will auto-classify
 * each article into the best matching category during processing.
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
    const categoryId = (formData.get("categoryId") as string) || null;
    const autoProcess = formData.get("autoProcess") === "true";
    const autoCategorize = formData.get("autoCategorize") === "true";

    // categoryId is optional — if not provided, AI will classify later
    if (categoryId) {
      // Verify category exists (only if provided)
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
    }

    // Ensure categoryId can be NULL in the database
    await ensureCategoryIdNullable();

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
      categoryId: string | null;
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
        // categoryId may be null — AI will assign it later
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

        // Upload file to storage (with fallback)
        let fileUrl = "";
        try {
          const storageKey = generateStorageKey("article", articleId, file.name);
          const uploadResult = await storageProvider.upload(
            storageKey,
            file.stream(),
            file.type
          );
          fileUrl = uploadResult.url;
        } catch (storageErr) {
          console.warn(`[bulk-upload] Storage upload failed for ${file.name}:`, storageErr);
          // Continue without file URL — the article is still created
        }

        // Update article with file URL (if upload succeeded)
        if (fileUrl) {
          await pool.query(
            `UPDATE articles SET "${articleField}" = $1 WHERE id = $2`,
            [fileUrl, articleId]
          );
        }

        // Create media record (even if storage failed, record the file metadata)
        try {
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
              file.size,
              fileUrl || "",
              null,
              null,
              articleId,
              userId,
            ]
          );
        } catch (mediaErr) {
          console.warn(`[bulk-upload] Media record failed for ${file.name}:`, mediaErr);
          // Continue — article is still created
        }

        // Create processing queue entries
        // Always add ai_metadata (it will also handle category assignment if autoCategorize)
        const queueTypes = ["ai_metadata"];
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
                  originalCategoryId: categoryId,
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
          categoryId,
        });
      } catch (fileErr) {
        console.error(`[bulk-upload] Error processing file ${file.name}:`, fileErr);
        const msg = fileErr instanceof Error ? fileErr.message : "Ошибка загрузки";
        errors.push({ fileName: file.name, error: msg });
      }
    }

    // If ALL files failed, return error
    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: `Не удалось загрузить ни одного файла`,
        errors,
      }, { status: 500 });
    }

    const categorizeNote = !categoryId || autoCategorize
      ? " AI автоматически определит категории." : "";

    const storageWarning = errors.some(e => e.error.includes("Storage") || e.error.includes("BLOB"))
      ? " Внимание: хранилище файлов не настроено (BLOB_READ_WRITE_TOKEN)." : "";

    return NextResponse.json({
      message: `Загружено ${results.length} из ${files.length} файлов.${categorizeNote}${storageWarning}`,
      articles: results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: results.length > 0 ? 201 : 500 });
  } catch (error) {
    console.error("[bulk-upload] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
