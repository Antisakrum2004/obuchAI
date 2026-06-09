/**
 * S3StorageProvider — реализация StorageProvider через AWS S3 / Selectel Object Storage.
 * Использует @aws-sdk/client-s3 для upload/delete и @aws-sdk/s3-request-presigner
 * для генерации временных подписанных ссылок (Signed URLs).
 *
 * Бакет полностью приватный — файлы доступны только через Signed URLs.
 * Это предотвращает слив видеокурсов — ссылки истекают через заданное время.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { StorageProvider, UploadResult } from "./storage-provider";

// ── Конфигурация из env ──────────────────────────────────────

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "ru-7";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "[S3Storage] Missing required env vars: S3_ENDPOINT, S3_ACCESS_KEY_ID, " +
      "S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME"
    );
  }

  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

// ── Singleton S3Client ───────────────────────────────────────

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
  s3Bucket: string | undefined;
};

function createS3Client(): { client: S3Client; bucket: string } {
  const config = getS3Config();

  const clientConfig: S3ClientConfig = {
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Selectel S3 использует path-style (не virtual-hosted)
    forcePathStyle: true,
  };

  const client = new S3Client(clientConfig);

  return { client, bucket: config.bucket };
}

function getS3Client(): { client: S3Client; bucket: string } {
  if (!globalForS3.s3Client || !globalForS3.s3Bucket) {
    const { client, bucket } = createS3Client();
    globalForS3.s3Client = client;
    globalForS3.s3Bucket = bucket;

    if (process.env.NODE_ENV !== "production") {
      globalForS3.s3Client = client;
      globalForS3.s3Bucket = bucket;
    }
  }

  return { client: globalForS3.s3Client, bucket: globalForS3.s3Bucket };
}

// ── S3StorageProvider ────────────────────────────────────────

export class S3StorageProvider implements StorageProvider {
  /**
   * Загрузить файл в S3 (Selectel Object Storage)
   */
  async upload(
    key: string,
    body: BodyInit,
    contentType?: string
  ): Promise<UploadResult> {
    const { client, bucket } = getS3Client();

    // Конвертируем BodyInit в Uint8Array / Buffer для S3
    let bodyBytes: Uint8Array | string;
    if (body instanceof ReadableStream) {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const combined = new Uint8Array(
        chunks.reduce((acc, c) => acc + c.length, 0)
      );
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      bodyBytes = combined;
    } else if (body instanceof Blob) {
      bodyBytes = new Uint8Array(await body.arrayBuffer());
    } else if (typeof body === "string") {
      bodyBytes = body;
    } else if (body instanceof ArrayBuffer) {
      bodyBytes = new Uint8Array(body);
    } else {
      // Buffer, Uint8Array и прочее
      bodyBytes = new Uint8Array(
        body as unknown as ArrayBuffer
      );
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyBytes,
      ContentType: contentType || "application/octet-stream",
      // Файлы приватные — не ставим ACL
    });

    const result = await client.send(command);

    // Возвращаем URL в формате Selectel: endpoint/bucket/key
    const config = getS3Config();
    const url = `${config.endpoint}/${bucket}/${key}`;

    // Получаем размер если возможно
    let size = 0;
    try {
      if (bodyBytes instanceof Uint8Array) {
        size = bodyBytes.byteLength;
      } else if (typeof bodyBytes === "string") {
        size = new TextEncoder().encode(bodyBytes).byteLength;
      }
    } catch {
      // size unknown
    }

    return {
      url,
      key,
      size,
      contentType: contentType || "",
    };
  }

  /**
   * Удалить файл из S3 по URL или ключу
   */
  async delete(urlOrKey: string): Promise<void> {
    const { client, bucket } = getS3Client();

    // Извлекаем ключ из полного URL или используем как ключ напрямую
    const key = this.extractKeyFromUrl(urlOrKey);

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  }

  /**
   * Получить публичный URL по ключу.
   * Для приватного бакета — возвращает конструируемый URL
   * (файл всё равно недоступен без Signed URL).
   */
  async getUrl(key: string): Promise<string> {
    const config = getS3Config();
    return `${config.endpoint}/${config.bucket}/${key}`;
  }

  /**
   * Генерация Signed URL для приватного доступа к файлу.
   * Ссылка истекает через expiresIn секунд.
   * Используется для стриминга видео через HTML5 <video>.
   */
  async getSignedUrl(
    key: string,
    expiresIn: number = 900 // 15 минут по умолчанию
  ): Promise<string> {
    const { client, bucket } = getS3Client();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  }

  /**
   * Получить метаданные файла (размер, contentType) без скачивания
   */
  async getMetadata(
    key: string
  ): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
    const { client, bucket } = getS3Client();

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const result = await client.send(command);

      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? "application/octet-stream",
        lastModified: result.LastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Извлечь ключ объекта из полного URL.
   * Формат URL: https://s3.ru-7.storage.selcloud.ru/ati-lab/knowledge/...
   * Ключ: knowledge/...
   */
  private extractKeyFromUrl(url: string): string {
    try {
      const config = getS3Config();
      const prefix = `${config.endpoint}/${config.bucket}/`;
      if (url.startsWith(prefix)) {
        return url.slice(prefix.length);
      }
      // Если это уже ключ (без протокола) — возвращаем как есть
      if (!url.startsWith("http")) {
        return url;
      }
      // Fallback: парсим URL и берём путь без ведущего bucket
      const parsed = new URL(url);
      const pathParts = parsed.pathname.slice(1); // убираем ведущий /
      const bucketPrefix = `${config.bucket}/`;
      if (pathParts.startsWith(bucketPrefix)) {
        return pathParts.slice(bucketPrefix.length);
      }
      return pathParts;
    } catch {
      return url;
    }
  }
}
