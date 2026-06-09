/**
 * Фабрика StorageProvider.
 * Возвращает нужную реализацию в зависимости от окружения.
 *
 * Приоритет:
 * 1. STORAGE_PROVIDER env var ("s3" | "vercel-blob" | "minio" | "memory")
 * 2. Если Vercel Blob токен есть → VercelBlobStorageProvider
 * 3. Иначе → MemoryStorageProvider (файлы не сохраняются, но не падает)
 */

import type { StorageProvider } from "./storage-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";
import { S3StorageProvider } from "./s3-storage-provider";
import { MemoryStorageProvider } from "./memory-storage-provider";

// Singleton — не пересоздаём при HMR
const globalForStorage = globalThis as unknown as {
  storageProvider: StorageProvider | undefined;
};

function createStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "auto";

  switch (provider) {
    case "s3":
      return new S3StorageProvider();

    case "vercel-blob":
      return new VercelBlobStorageProvider();

    case "memory":
      console.warn("[Storage] Using MemoryStorageProvider — files will NOT persist!");
      return new MemoryStorageProvider();

    case "auto":
    default: {
      // Check if S3 is configured first
      const hasS3Config =
        !!process.env.S3_ENDPOINT &&
        !!process.env.S3_ACCESS_KEY_ID &&
        !!process.env.S3_SECRET_ACCESS_KEY &&
        !!process.env.S3_BUCKET_NAME;

      if (hasS3Config) {
        console.log("[Storage] Auto-detected S3 configuration → S3StorageProvider");
        return new S3StorageProvider();
      }

      // Check if Vercel Blob token is configured
      const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
      if (hasBlobToken) {
        return new VercelBlobStorageProvider();
      }

      console.warn(
        "[Storage] Neither S3 nor Vercel Blob configured. Using MemoryStorageProvider. " +
        "Files will NOT persist. Set S3_* vars or BLOB_READ_WRITE_TOKEN."
      );
      return new MemoryStorageProvider();
    }
  }
}

export const storageProvider: StorageProvider =
  globalForStorage.storageProvider ?? createStorageProvider();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storageProvider = storageProvider;
}

// Re-export S3StorageProvider specifically for use in signed URL generation
export { S3StorageProvider } from "./s3-storage-provider";

export type { StorageProvider, UploadResult } from "./storage-provider";
