/**
 * StorageProvider — абстракция над файловым хранилищем.
 * Позволяет переключаться между Vercel Blob, AWS S3, MinIO и т.д.
 * без изменения бизнес-логики (MediaService).
 */

export interface UploadResult {
  /** URL для доступа к файлу */
  url: string;
  /** Уникальный ключ файла в хранилище */
  key: string;
  /** Размер файла в байтах */
  size: number;
  /** MIME-тип файла */
  contentType: string;
}

export interface StorageProvider {
  /**
   * Загрузить файл в хранилище
   * @param key — путь/ключ файла (например, "knowledge/articles/abc123/video.mp4")
   * @param body — содержимое файла
   * @param contentType — MIME-тип
   */
  upload(key: string, body: BodyInit, contentType?: string): Promise<UploadResult>;

  /**
   * Удалить файл из хранилища
   * @param url — URL файла для удаления
   */
  delete(url: string): Promise<void>;

  /**
   * Получить URL для доступа к файлу
   * @param key — ключ файла в хранилище
   */
  getUrl(key: string): Promise<string>;
}
