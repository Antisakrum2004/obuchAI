/**
 * VercelBlobStorageProvider — реализация StorageProvider через @vercel/blob.
 * Используется по умолчанию для MVP.
 * Потом можно заменить на S3StorageProvider без изменений в MediaService.
 */

import { put, del, head } from "@vercel/blob";
import type { StorageProvider, UploadResult } from "./storage-provider";

export class VercelBlobStorageProvider implements StorageProvider {
  /**
   * Загрузить файл в Vercel Blob
   */
  async upload(
    key: string,
    body: BodyInit,
    contentType?: string
  ): Promise<UploadResult> {
    const blob = await put(key, body as Parameters<typeof put>[1], {
      contentType: contentType || undefined,
      access: "public",
    });

    return {
      url: blob.url,
      key: blob.pathname,
      size: 0, // Vercel Blob doesn't return size in PutBlobResult
      contentType: contentType || "",
    };
  }

  /**
   * Удалить файл из Vercel Blob по URL
   */
  async delete(url: string): Promise<void> {
    await del(url);
  }

  /**
   * Получить URL по ключу.
   * Для Vercel Blob URL = https://[store].public.blob.vercel-storage.com/[key]
   * head() возвращает метаданные, включая URL.
   */
  async getUrl(key: string): Promise<string> {
    try {
      const blob = await head(key);
      return blob.url;
    } catch {
      // Если файл не найден, возвращаем конструируемый URL
      // Vercel Blob URL формат: https://{store}.public.blob.vercel-storage.com/{key}
      return key;
    }
  }
}
