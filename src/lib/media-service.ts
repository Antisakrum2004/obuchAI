/**
 * MediaService — бизнес-логика работы с медиафайлами.
 * Не знает про конкретное хранилище (Vercel Blob, S3, MinIO).
 * Всё идёт через StorageProvider.
 */

import { storageProvider } from "@/lib/storage";
import { db } from "@/lib/db";
import { pool } from "@/lib/db";

// ── Типы файлов ──────────────────────────────────────────────

export const ALLOWED_FILE_TYPES: Record<
  string,
  { mimeTypes: string[]; maxSize: number; fileType: string }
> = {
  video: {
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maxSize: 2 * 1024 * 1024 * 1024, // 2 GB
    fileType: "video",
  },
  pdf: {
    mimeTypes: ["application/pdf"],
    maxSize: 100 * 1024 * 1024, // 100 MB
    fileType: "document",
  },
  pptx: {
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSize: 200 * 1024 * 1024, // 200 MB
    fileType: "document",
  },
  docx: {
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSize: 100 * 1024 * 1024, // 100 MB
    fileType: "document",
  },
  image: {
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    maxSize: 20 * 1024 * 1024, // 20 MB
    fileType: "image",
  },
};

/**
 * Определить fileType по MIME-типу
 */
export function detectFileType(
  mimeType: string
): { fileType: string; category: string } | null {
  for (const [category, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (config.mimeTypes.includes(mimeType)) {
      return { fileType: config.fileType, category };
    }
  }
  return null;
}

/**
 * Валидация файла перед загрузкой
 */
export function validateFile(
  file: { type: string; size: number; name: string }
): { valid: boolean; error?: string; fileType?: string; category?: string } {
  const detected = detectFileType(file.type);

  if (!detected) {
    const allowed = Object.values(ALLOWED_FILE_TYPES)
      .flatMap((c) => c.mimeTypes)
      .join(", ");
    return {
      valid: false,
      error: `Неподдерживаемый тип файла: ${file.type}. Допустимые: ${allowed}`,
    };
  }

  const config = ALLOWED_FILE_TYPES[detected.category];
  if (file.size > config.maxSize) {
    const maxMB = Math.round(config.maxSize / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Файл слишком большой: ${fileMB} МБ. Максимум для ${detected.category}: ${maxMB} МБ`,
    };
  }

  return {
    valid: true,
    fileType: detected.fileType,
    category: detected.category,
  };
}

/**
 * Генерация пути в хранилище
 * Формат: knowledge/{entityType}/{entityId}/{timestamp}_{filename}
 */
export function generateStorageKey(
  entityType: "article" | "lesson" | "space",
  entityId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._-]/g, "_");
  return `knowledge/${entityType}s/${entityId}/${timestamp}_${sanitized}`;
}

// ── MediaService ─────────────────────────────────────────────

export const MediaService = {
  /**
   * Загрузить файл и создать запись в БД
   */
  async uploadAndCreate(params: {
    file: File;
    entityType: "article" | "lesson" | "space";
    entityId: string;
    uploadedBy?: string;
  }): Promise<{
    id: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    url: string;
    thumbnailUrl: string | null;
    duration: number | null;
  }> {
    const { file, entityType, entityId, uploadedBy } = params;

    // Валидация
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Генерация ключа хранилища
    const storageKey = generateStorageKey(entityType, entityId, file.name);

    // Загрузка в StorageProvider
    const result = await storageProvider.upload(
      storageKey,
      file.stream(),
      file.type
    );

    // Определение длительности для видео (пока null — потом добавим FFmpeg)
    const duration =
      validation.category === "video" ? null : null;

    // Создание записи в БД через raw SQL (как принято в проекте)
    const id = generateId();
    const articleId = entityType === "article" ? entityId : null;

    await pool.query(
      `INSERT INTO media (id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", duration, "articleId", "uploadedBy", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        file.name,
        validation.fileType,
        file.type,
        result.size || file.size,
        result.url,
        null, // thumbnailUrl — потом FFmpeg
        duration,
        articleId,
        uploadedBy || null,
      ]
    );

    return {
      id,
      fileName: file.name,
      fileType: validation.fileType!,
      mimeType: file.type,
      fileSize: result.size || file.size,
      url: result.url,
      thumbnailUrl: null,
      duration,
    };
  },

  /**
   * Получить медиа для статьи
   */
  async getByArticle(articleId: string): Promise<
    Array<{
      id: string;
      fileName: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
      url: string;
      thumbnailUrl: string | null;
      duration: number | null;
      createdAt: string;
    }>
  > {
    const result = await pool.query(
      `SELECT id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", duration, "createdAt"
       FROM media
       WHERE "articleId" = $1
       ORDER BY "createdAt" ASC`,
      [articleId]
    );
    return result.rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * Получить медиа по ID
   */
  async getById(
    mediaId: string
  ): Promise<{
    id: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    url: string;
    thumbnailUrl: string | null;
    duration: number | null;
    articleId: string | null;
    uploadedBy: string | null;
    createdAt: string;
  } | null> {
    const result = await pool.query(
      `SELECT id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", duration, "articleId", "uploadedBy", "createdAt"
       FROM media
       WHERE id = $1`,
      [mediaId]
    );
    if (result.rows.length === 0) return null;
    return {
      ...result.rows[0],
      createdAt: result.rows[0].createdAt.toISOString(),
    };
  },

  /**
   * Удалить медиа (из хранилища + из БД)
   */
  async delete(mediaId: string): Promise<boolean> {
    const media = await this.getById(mediaId);
    if (!media) return false;

    // Удалить из хранилища
    try {
      await storageProvider.delete(media.url);
    } catch (err) {
      console.error("Failed to delete file from storage:", err);
      // Продолжаем — удаляем из БД даже если хранилище не ответило
    }

    // Удалить из БД
    await pool.query(`DELETE FROM media WHERE id = $1`, [mediaId]);
    return true;
  },

  /**
   * Привязать медиа к статье (если загружали без привязки)
   */
  async attachToArticle(mediaId: string, articleId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE media SET "articleId" = $1 WHERE id = $2`,
      [articleId, mediaId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Отвязать медиа от статьи
   */
  async detachFromArticle(mediaId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE media SET "articleId" = NULL WHERE id = $1`,
      [mediaId]
    );
    return (result.rowCount ?? 0) > 0;
  },
};

// ── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  // cuid-style ID — как принято в проекте
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cl${timestamp}${random}`;
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Иконка по типу файла
 */
export function getFileIcon(fileType: string, mimeType: string): string {
  if (fileType === "video") return "🎬";
  if (mimeType === "application/pdf") return "📄";
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("pptx")
  )
    return "📊";
  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("docx")
  )
    return "📝";
  if (fileType === "image") return "🖼️";
  return "📎";
}
