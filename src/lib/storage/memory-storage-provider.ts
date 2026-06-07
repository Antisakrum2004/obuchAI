/**
 * MemoryStorageProvider — in-memory storage for development/fallback.
 * Files are stored as base64 in a Map. They will NOT persist across server restarts.
 * Use this when Vercel Blob (or other cloud storage) is not configured.
 */

import type { StorageProvider, UploadResult } from "./storage-provider";

const store = new Map<string, { data: string; contentType: string }>();

export class MemoryStorageProvider implements StorageProvider {
  async upload(
    key: string,
    body: BodyInit,
    contentType?: string
  ): Promise<UploadResult> {
    // Convert body to base64
    let base64 = "";
    if (body instanceof ReadableStream) {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      base64 = Buffer.from(combined).toString("base64");
    } else if (body instanceof Blob) {
      const buffer = Buffer.from(await body.arrayBuffer());
      base64 = buffer.toString("base64");
    } else if (typeof body === "string") {
      base64 = Buffer.from(body).toString("base64");
    } else if (body instanceof ArrayBuffer) {
      base64 = Buffer.from(body).toString("base64");
    } else {
      base64 = Buffer.from(String(body)).toString("base64");
    }

    const size = Math.ceil(base64.length * 0.75);
    store.set(key, { data: base64, contentType: contentType || "application/octet-stream" });

    // Return a data URL that can be used immediately
    const dataUrl = `data:${contentType || "application/octet-stream"};base64,${base64.substring(0, 100)}...`;

    return {
      url: `/api/knowledge/storage/${encodeURIComponent(key)}`,
      key,
      size,
      contentType: contentType || "",
    };
  }

  async delete(url: string): Promise<void> {
    // Try to find and delete by key extracted from URL
    for (const [key] of store) {
      if (url.includes(key)) {
        store.delete(key);
        return;
      }
    }
  }

  async getUrl(key: string): Promise<string> {
    const entry = store.get(key);
    if (entry) {
      return `/api/knowledge/storage/${encodeURIComponent(key)}`;
    }
    return key;
  }
}
