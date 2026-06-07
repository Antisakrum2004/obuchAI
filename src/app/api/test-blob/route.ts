import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";

/**
 * GET /api/test-blob
 * Тестовый эндпоинт для проверки подключения Blob Store.
 * Создаёт временный файл, проверяет URL, удаляет файл.
 */
export async function GET() {
  try {
    // Проверяем наличие BLOB_STORE_ID
    const storeId = process.env.BLOB_STORE_ID;
    const oidcToken = process.env.VERCEL_OIDC_TOKEN;
    const rwToken = process.env.BLOB_READ_WRITE_TOKEN;

    const authInfo = {
      storeId: storeId || "NOT SET",
      oidcTokenAvailable: !!oidcToken,
      rwTokenAvailable: !!rwToken,
      oidcTokenPrefix: oidcToken ? oidcToken.substring(0, 20) + "..." : null,
      vercelEnv: process.env.VERCEL || "NOT SET",
      vercelRegion: process.env.VERCEL_REGION || "NOT SET",
    };

    // Пробуем загрузить тестовый файл
    const testContent = `blob-test-${Date.now()}`;
    const testKey = `_test/blob-check-${Date.now()}.txt`;

    let uploadResult;
    try {
      const blob = await put(testKey, testContent, {
        access: "public",
        contentType: "text/plain",
      });
      uploadResult = {
        success: true,
        url: blob.url,
        pathname: blob.pathname,
      };

      // Удаляем тестовый файл
      try {
        await del(blob.url);
      } catch {
        // Не критично
      }
    } catch (uploadError) {
      uploadResult = {
        success: false,
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      };
    }

    return NextResponse.json({
      status: uploadResult.success ? "OK" : "FAILED",
      auth: authInfo,
      upload: uploadResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
