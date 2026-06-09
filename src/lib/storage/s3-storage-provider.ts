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
  ListObjectsV2Command,
  GetObjectCommand,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// ── Presigning S3Client (removes ChecksumMode to avoid Selectel issues) ──

const globalForPresigning = globalThis as unknown as {
  presigningClient: S3Client | undefined;
};

/**
 * Creates an S3Client specifically for presigning URLs.
 * This client has middleware that removes the `ChecksumMode` parameter
 * from GetObjectCommand before presigning. Without this, AWS SDK v3
 * automatically adds `x-amz-checksum-mode=ENABLED` to signed URLs,
 * which Selectel S3 does not support and causes ERR_CONNECTION_RESET.
 */
function getPresigningClient(): S3Client {
  if (globalForPresigning.presigningClient) {
    return globalForPresigning.presigningClient;
  }

  const config = getS3Config();

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  // Remove ChecksumMode from GetObjectCommand inputs before presigning.
  // This prevents `x-amz-checksum-mode=ENABLED` from appearing in signed URLs.
  client.middlewareStack.addRelativeTo(
    (next) => async (args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((args as any).input?.ChecksumMode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (args as any).input.ChecksumMode;
      }
      return next(args);
    },
    {
      name: "removeChecksumMode",
      relation: "before",
      toMiddleware: "presignInterceptMiddleware",
    }
  );

  globalForPresigning.presigningClient = client;
  return client;
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
   *
   * Для больших файлов (видео 500МБ+) браузер делает много range-запросов,
   * поэтому нужно больше времени (1 час вместо 15 мин).
   */
  async getSignedUrl(
    key: string,
    expiresIn: number = 3600 // 1 час по умолчанию (было 15 мин — мало для больших видео)
  ): Promise<string> {
    const { client, bucket } = getS3Client();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      // NOTE: ResponseContentType removed — it adds `response-content-type` to the signed URL
      // which may cause issues with Selectel S3. The Content-Type is now set by the streaming
      // proxy in the API route, so this is no longer needed.
    });

    // Use the presigning client (with middleware to remove ChecksumMode)
    const presigningClient = getPresigningClient();
    const signedUrl = await getSignedUrl(presigningClient, command, { expiresIn });
    return signedUrl;
  }

  /**
   * Проверить существование файла в S3 и получить его метаданные.
   * Если ключ не найден, пытается найти файл через ListObjectsV2
   * (полезно когда ключ содержит кириллицу/пробелы и может не совпадать).
   *
   * Возвращает реальный ключ объекта или null если файл не найден.
   */
  async resolveKey(s3Key: string): Promise<{ key: string; size: number; contentType: string } | null> {
    const { client, bucket } = getS3Client();

    // 1. Сначала пробуем HeadObject с ключом как есть
    try {
      const headResult = await client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      }));
      return {
        key: s3Key,
        size: headResult.ContentLength ?? 0,
        contentType: headResult.ContentType ?? 'application/octet-stream',
      };
    } catch {
      // Key not found with exact match — try alternatives
    }

    // 2. Пробуем URL-декодированный ключ (если ключ был закодирован при сохранении)
    try {
      const decodedKey = decodeURIComponent(s3Key);
      if (decodedKey !== s3Key) {
        const headResult = await client.send(new HeadObjectCommand({
          Bucket: bucket,
          Key: decodedKey,
        }));
        return {
          key: decodedKey,
          size: headResult.ContentLength ?? 0,
          contentType: headResult.ContentType ?? 'application/octet-stream',
        };
      }
    } catch {
      // Decoded key not found either
    }

    // 3. Пробуем URL-кодированный ключ (если ключ содержит кириллицу/пробелы)
    try {
      const encodedKey = s3Key.split('/').map(segment => encodeURIComponent(segment)).join('/');
      if (encodedKey !== s3Key) {
        const headResult = await client.send(new HeadObjectCommand({
          Bucket: bucket,
          Key: encodedKey,
        }));
        return {
          key: encodedKey,
          size: headResult.ContentLength ?? 0,
          contentType: headResult.ContentType ?? 'application/octet-stream',
        };
      }
    } catch {
      // Encoded key not found either
    }

    // 4. Fallback: ListObjectsV2 с префиксом — ищем файл по началу ключа
    // Это полезно когда кириллица или спецсимволы в ключе не совпадают
    try {
      // Берём префикс — всё до последнего /
      const lastSlash = s3Key.lastIndexOf('/');
      const prefix = lastSlash > 0 ? s3Key.substring(0, lastSlash + 1) : '';
      const fileName = lastSlash > 0 ? s3Key.substring(lastSlash + 1) : s3Key;

      if (prefix && fileName) {
        const listResult = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 100,
        }));

        if (listResult.Contents) {
          // Ищем файл с похожим именем (нечувствительно к кодировке)
          const fileNameLower = fileName.toLowerCase().replace(/\+/g, ' ');
          for (const obj of listResult.Contents) {
            if (!obj.Key) continue;
            const objFileName = obj.Key.substring(obj.Key.lastIndexOf('/') + 1).toLowerCase();
            // Точное совпадение имени файла (после нормализации)
            if (objFileName === fileNameLower ||
                objFileName.replace(/%20/g, ' ') === fileNameLower ||
                decodeURIComponent(objFileName) === fileNameLower ||
                objFileName === fileName.toLowerCase()) {
              return {
                key: obj.Key,
                size: obj.Size ?? 0,
                contentType: 'application/octet-stream',
              };
            }
          }

          // Если точного совпадения нет — ищем файл который заканчивается похожим образом
          const baseName = fileNameLower.replace(/\s*\(\d+p\)\s*\.\w+$/, '').replace(/[()\s+]/g, '');
          for (const obj of listResult.Contents) {
            if (!obj.Key) continue;
            const objBaseName = obj.Key.substring(obj.Key.lastIndexOf('/') + 1)
              .toLowerCase()
              .replace(/\s*\(\d+p\)\s*\.\w+$/, '')
              .replace(/[()\s+]/g, '');
            if (baseName && objBaseName === baseName) {
              return {
                key: obj.Key,
                size: obj.Size ?? 0,
                contentType: 'application/octet-stream',
              };
            }
          }
        }
      }
    } catch (listErr) {
      console.error('[S3Storage] ListObjectsV2 fallback failed:', listErr);
    }

    return null;
  }

  /**
   * Стриминг файла напрямую из S3 через AWS SDK GetObjectCommand.
   * НЕ использует signed URLs — работает напрямую через SDK,
   * что решает проблемы с кодировкой кириллицы в ключах
   * и избегает ERR_CONNECTION_RESET от Selectel.
   *
   * Поддерживает HTTP Range-запросы для видео-перемотки.
   *
   * @param key S3-ключ файла (после resolveKey)
   * @param range HTTP Range-заголовок (например, "bytes=0-1048575")
   * @returns Объект с потоком данных и заголовками ответа
   */
  async streamObject(
    key: string,
    range?: string
  ): Promise<{
    body: NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
    contentRange?: string;
    totalSize: number;
    statusCode: number;
  }> {
    const { client, bucket } = getS3Client();

    const input: any = {
      Bucket: bucket,
      Key: key,
    };

    if (range) {
      input.Range = range;
    }

    const command = new GetObjectCommand(input);
    const response = await client.send(command);

    if (!response.Body) {
      throw new Error(`S3 GetObject returned empty body for key: ${key}`);
    }

    // Node.js Readable stream from AWS SDK
    const body = response.Body as NodeJS.ReadableStream;

    const contentType = response.ContentType ?? "application/octet-stream";
    const contentLength = response.ContentLength ?? 0;
    const contentRange = response.ContentRange ?? undefined;

    // Parse total size from ContentRange header (format: "bytes START-END/TOTAL")
    let totalSize = contentLength;
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) {
        totalSize = parseInt(match[1], 10);
      }
    }

    const statusCode = response.$metadata.httpStatusCode ?? (range ? 206 : 200);

    return {
      body,
      contentType,
      contentLength,
      contentRange,
      totalSize,
      statusCode: statusCode === 206 ? 206 : 200,
    };
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
