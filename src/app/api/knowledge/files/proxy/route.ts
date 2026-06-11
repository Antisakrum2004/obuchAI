import { NextRequest, NextResponse } from "next/server";
import { storageProvider, S3StorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/files/proxy?url=...&key=...
 *
 * Proxy endpoint that streams files from private S3 storage.
 * Generates a signed URL and redirects, or streams the file directly.
 *
 * This is the fallback for when signed URL generation fails client-side
 * (e.g., CORS issues with Selectel S3).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    const fileKey = searchParams.get("key");
    const mode = searchParams.get("mode") || "redirect"; // "redirect" or "stream"

    if (!rawUrl && !fileKey) {
      return NextResponse.json(
        { error: "url или key обязательный параметр" },
        { status: 400 }
      );
    }

    // If not S3 storage, just redirect to the URL
    if (!(storageProvider instanceof S3StorageProvider)) {
      if (rawUrl) {
        return NextResponse.redirect(rawUrl);
      }
      return NextResponse.json({ error: "URL не указан" }, { status: 400 });
    }

    const s3 = storageProvider as S3StorageProvider;

    // Determine the S3 key
    let key = fileKey;
    if (!key && rawUrl) {
      key = s3.extractKeyFromUrl(rawUrl);
    }

    if (!key) {
      return NextResponse.json(
        { error: "Не удалось определить ключ файла" },
        { status: 400 }
      );
    }

    // Try to resolve the key (handles encoding issues with Cyrillic filenames)
    let resolvedKey = key;
    try {
      const resolved = await s3.resolveKey(key);
      if (resolved) {
        resolvedKey = resolved.key;
      }
    } catch {
      // Use the original key
    }

    // Mode: redirect — generate signed URL and redirect
    if (mode === "redirect") {
      try {
        const signedUrl = await s3.getSignedUrl(resolvedKey, 3600);
        return NextResponse.redirect(signedUrl);
      } catch (err) {
        console.warn("[FileProxy] Signed URL failed, falling back to stream:", err);
        // Fall through to stream mode
      }
    }

    // Mode: stream — stream file directly through server
    try {
      const range = request.headers.get("range") || undefined;
      const result = await s3.streamObject(resolvedKey, range);

      const headers: Record<string, string> = {
        "Content-Type": result.contentType,
        "Content-Length": String(result.contentLength),
        "Cache-Control": "private, max-age=3600",
      };

      if (result.contentRange) {
        headers["Content-Range"] = result.contentRange;
      }

      // Handle Accept-Ranges for video seeking
      headers["Accept-Ranges"] = "bytes";

      return new NextResponse(result.body as any, {
        status: result.statusCode,
        headers,
      });
    } catch (streamErr) {
      console.error("[FileProxy] Stream failed:", streamErr);
      return NextResponse.json(
        { error: "Не удалось получить файл из хранилища" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[FileProxy] Error:", error);
    return NextResponse.json(
      { error: "Ошибка проксирования файла" },
      { status: 500 }
    );
  }
}
