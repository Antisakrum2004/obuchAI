/**
 * Фабрика StorageProvider.
 * Возвращает нужную реализацию в зависимости от окружения.
 *
 * Приоритет:
 * 1. STORAGE_PROVIDER env var
 * 2. Если Vercel Blob токен есть → VercelBlobStorageProvider
 * 3. Иначе → MemoryStorageProvider (файлы не сохраняются, но не падает)
 */

import type { StorageProvider } from "./storage-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";
import { MemoryStorageProvider } from "./memory-storage-provider";

// Singleton — не пересоздаём при HMR
const globalForStorage = globalThis as unknown as {
  storageProvider: StorageProvider | undefined;
};

function createStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "auto";

  switch (provider) {
    case "vercel-blob":
      return new VercelBlobStorageProvider();

    case "memory":
      console.warn("[Storage] Using MemoryStorageProvider — files will NOT persist!");
      return new MemoryStorageProvider();

    case "auto":
    default: {
      // Check if Vercel Blob token is configured
      const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
      if (hasBlobToken) {
        return new VercelBlobStorageProvider();
      }
      console.warn(
        "[Storage] BLOB_READ_WRITE_TOKEN not set. Using MemoryStorageProvider. " +
        "Files will NOT persist. Set BLOB_READ_WRITE_TOKEN or STORAGE_PROVIDER=vercel-blob."
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

export type { StorageProvider, UploadResult } from "./storage-provider";
