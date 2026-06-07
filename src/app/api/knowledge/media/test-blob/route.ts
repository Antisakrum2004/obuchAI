import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

/**
 * GET /api/knowledge/media/test-blob
 * Временный тестовый эндпоинт для проверки подключения Blob Storage
 */
export async function GET() {
  try {
    const result = await list({ limit: 5 });
    return NextResponse.json({
      connected: true,
      storeId: process.env.BLOB_STORE_ID || "not set",
      blobCount: result.blobs.length,
      blobs: result.blobs.map(b => ({ url: b.url, size: b.size })),
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      storeId: process.env.BLOB_STORE_ID || "not set",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
