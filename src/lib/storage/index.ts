/**
 * Фабрика StorageProvider.
 * Возвращает нужную реализацию в зависимости от окружения.
 *
 * Сейчас: Vercel Blob (MVP)
 * Потом: S3 / MinIO через env var STORAGE_PROVIDER
 */

import type { StorageProvider } from "./storage-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";

// Singleton — не пересоздаём при HMR
const globalForStorage = globalThis as unknown as {
  storageProvider: StorageProvider | undefined;
};

function createStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "vercel-blob";

  switch (provider) {
    case "vercel-blob":
      return new VercelBlobStorageProvider();

    // Будущие реализации:
    // case "s3":
    //   return new S3StorageProvider({ ... });
    // case "minio":
    //   return new MinIOStorageProvider({ ... });

    default:
      console.warn(
        `Unknown STORAGE_PROVIDER "${provider}", falling back to Vercel Blob`
      );
      return new VercelBlobStorageProvider();
  }
}

export const storageProvider: StorageProvider =
  globalForStorage.storageProvider ?? createStorageProvider();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storageProvider = storageProvider;
}

export type { StorageProvider, UploadResult } from "./storage-provider";
