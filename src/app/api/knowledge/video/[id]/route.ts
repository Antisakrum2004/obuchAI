import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import { Readable } from "stream";

/**
 * GET /api/knowledge/video/[id]
 *
 * Защищённый API-маршрут для стриминга видео из приватного S3 (Selectel).
 *
 * Теперь использует AWS SDK GetObjectCommand напрямую для стриминга
 * (без signed URLs), что решает проблемы с кириллицей в ключах
 * и избегает ERR_CONNECTION_RESET от Selectel.
 *
 * ?format=json → { url: signedUrl } для JS-клиента
 * без параметра → стриминг видео через сервер (proxy mode)
 */

// Singleton S3StorageProvider
const s3Provider = new S3StorageProvider();

// Runtime migration memo
let fileKeyEnsured = false;

async function ensureFileKeyColumn(): Promise<void> {
  if (fileKeyEnsured) return;
  try {
    await pool.query(`ALTER TABLE media ADD COLUMN IF NOT EXISTS "fileKey" TEXT`);
  } catch {
    // Column already exists — not critical
  }
  fileKeyEnsured = true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Проверка авторизации ─────────────────────────────────
    const sessionResult = await getServerSession(authOptions);
    const session = sessionResult ?? undefined;
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Доступ запрещен. Необходима авторизация." },
        { status: 401 }
      );
    }

    // ── 2. Ensure fileKey column exists ────────────────────────
    await ensureFileKeyColumn();

    // ── 3. Получаем file_key видео из БД (raw SQL) ─────────────
    const { id } = await params;

    const result = await pool.query(
      `SELECT id, "fileName", "mimeType", "fileType", url, "fileKey"
       FROM media
       WHERE id = $1 AND "fileType" = 'video'`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: "Видео не найдено" },
        { status: 404 }
      );
    }

    const media = result.rows[0];

    // Определяем S3-ключ: fileKey (приоритет) или извлекаем из URL
    let s3Key: string;

    if (media.fileKey) {
      s3Key = media.fileKey;
    } else {
      const url = media.url as string;

      if (!url) {
        return NextResponse.json(
          { error: "У видео отсутствует ссылка на файл" },
          { status: 500 }
        );
      }

      const endpoint = process.env.S3_ENDPOINT || "";
      const bucket = process.env.S3_BUCKET_NAME || "";
      const prefix = `${endpoint}/${bucket}/`;

      if (url.startsWith("s3://")) {
        const withoutProtocol = url.slice(5);
        const slashIndex = withoutProtocol.indexOf("/");
        if (slashIndex > 0) {
          s3Key = withoutProtocol.slice(slashIndex + 1);
        } else {
          return NextResponse.json(
            { error: "Некорректный формат s3:// URI" },
            { status: 400 }
          );
        }
      } else if (url.startsWith(prefix)) {
        s3Key = url.slice(prefix.length);
      } else if (!url.startsWith("http")) {
        s3Key = url;
      } else {
        // URL не из нашего S3 — редирект на оригинальный URL
        console.warn(
          `[video/${id}] URL не из S3, перенаправление на оригинал:`,
          url
        );
        return NextResponse.redirect(url);
      }
    }

    // ── 4. Resolve key & stream ───────────────────────────────
    const resolved = await s3Provider.resolveKey(s3Key);

    let actualKey = s3Key;

    if (resolved) {
      actualKey = resolved.key;
      const fileSizeMB = Math.round(resolved.size / 1024 / 1024);
      console.log(`[video/${id}] Key resolved: "${actualKey}" (${fileSizeMB}MB)`);

      // Update media fileKey with correct key if it differs
      if (actualKey !== s3Key) {
        try {
          await pool.query(
            `UPDATE media SET "fileKey" = $2 WHERE id = $1`,
            [media.id, actualKey]
          );
          console.log(`[video/${id}] fileKey corrected in DB`);
        } catch {}
      }
    } else {
      console.warn(`[video/${id}] Key not found via resolveKey, trying direct: "${s3Key}"`);
    }

    // ── 5. Return result ──────────────────────────────────────
    const format = request.nextUrl.searchParams.get("format");

    // Backward compatibility: return signed URL as JSON
    if (format === "json") {
      const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);
      return NextResponse.json({ url: signedUrl });
    }

    // ── Streaming proxy mode ──────────────────────────────────
    // Use AWS SDK GetObjectCommand directly (no signed URLs)
    const rangeHeader = request.headers.get("Range");
    console.log(`[video/${id}] Streaming via SDK: "${actualKey}"${rangeHeader ? ` (Range: ${rangeHeader})` : ""}`);

    try {
      const s3Stream = await s3Provider.streamObject(actualKey, rangeHeader || undefined);

      const responseHeaders = new Headers();
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Content-Type", s3Stream.contentType || "video/mp4");
      responseHeaders.set("Content-Length", String(s3Stream.contentLength));

      if (s3Stream.contentRange) {
        responseHeaders.set("Content-Range", s3Stream.contentRange);
      }

      responseHeaders.set("Cache-Control", "private, max-age=3600");

      // Convert Node.js Readable to Web ReadableStream
      const webStream = Readable.toWeb(s3Stream.body as Readable) as ReadableStream;

      return new Response(webStream, {
        status: s3Stream.statusCode,
        headers: responseHeaders,
      });
    } catch (streamErr) {
      console.error(`[video/${id}] SDK stream failed:`, streamErr);

      // Fallback: signed URL + fetch
      try {
        const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);
        const fetchHeaders: Record<string, string> = {};
        if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

        const s3Response = await fetch(signedUrl, {
          headers: fetchHeaders,
          redirect: "follow",
        });

        if (!s3Response.ok && s3Response.status !== 206) {
          return NextResponse.json(
            { error: "Не удалось получить видео из хранилища", details: `S3 returned ${s3Response.status}` },
            { status: s3Response.status === 404 ? 404 : 502 }
          );
        }

        const responseHeaders = new Headers();
        responseHeaders.set("Accept-Ranges", "bytes");
        responseHeaders.set("Content-Type", s3Response.headers.get("Content-Type") || "video/mp4");
        const contentLength = s3Response.headers.get("Content-Length");
        if (contentLength) responseHeaders.set("Content-Length", contentLength);
        const contentRange = s3Response.headers.get("Content-Range");
        if (contentRange) responseHeaders.set("Content-Range", contentRange);
        responseHeaders.set("Cache-Control", "private, max-age=3600");

        return new Response(s3Response.body, {
          status: s3Response.status === 206 ? 206 : 200,
          headers: responseHeaders,
        });
      } catch (fallbackErr) {
        console.error(`[video/${id}] All streaming methods failed:`, fallbackErr);
        return NextResponse.json(
          { error: "Не удалось получить видео из хранилища", details: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) },
          { status: 502 }
        );
      }
    }
  } catch (error) {
    console.error("[video/[id]] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
