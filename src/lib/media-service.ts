/**
 * MediaService — бизнес-логика работы с медиафайлами.
 * Не знает про конкретное хранилище (Vercel Blob, S3, MinIO).
 * Всё идёт через StorageProvider.
 *
 * ⚠️ Этот модуль импортирует серверные зависимости (db, storage).
 * Клиентские компоненты должны импортировать утилиты из @/lib/media-utils.
 */

import { storageProvider } from "@/lib/storage";
import { pool } from "@/lib/db";
import { ensureColumn } from "@/lib/db-migrate";
import {
  validateFile,
  detectFileType,
  generateStorageKey,
  formatFileSize,
  getFileIcon,
  ALLOWED_FILE_TYPES,
} from "@/lib/media-utils";

// Re-export для удобства (серверные маршруты могут импортировать отсюда)
export { validateFile, detectFileType, generateStorageKey, formatFileSize, getFileIcon, ALLOWED_FILE_TYPES };

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

    // Сохраняем fileKey — ключ в хранилище для генерации Signed URLs
    // Для S3: result.key (например, "knowledge/articles/xxx/video.mp4")
    // Для Vercel Blob: result.key (pathname)
    const fileKey = result.key || null;

    // Убедимся, что колонка fileKey существует (runtime migration, как принято в проекте)
    await ensureFileKeyColumn();

    await pool.query(
      `INSERT INTO media (id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", duration, "articleId", "uploadedBy", "fileKey", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
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
        fileKey,
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
      fileKey: string | null;
      createdAt: string;
    }>
  > {
    // Ensure fileKey column exists (runtime migration)
    await ensureFileKeyColumn();

    const result = await pool.query(
      `SELECT id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", duration, "fileKey", "createdAt"
       FROM media
       WHERE "articleId" = $1
       ORDER BY "createdAt" ASC`,
      [articleId]
    );
    return result.rows.map((row) => ({
      ...row,
      fileKey: row.fileKey || null,
      createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
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
 * Runtime check: ensure "fileKey" column exists in media table.
 * Delegates to the centralized db-migrate module.
 */
let fileKeyEnsured = false;

async function ensureFileKeyColumn(): Promise<void> {
  if (fileKeyEnsured) return;
  fileKeyEnsured = await ensureColumn("media", "fileKey", "TEXT");
}
