import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import { Readable } from "stream";

/**
 * GET /api/knowledge/video/by-article/[articleId]
 *
 * Streams video from S3 directly through AWS SDK GetObjectCommand.
 * Does NOT use signed URLs — works directly through SDK,
 * which solves Cyrillic key encoding issues and avoids ERR_CONNECTION_RESET from Selectel.
 *
 * Supports HTTP Range requests for video seeking.
 * The browser never connects to S3 directly.
 *
 * ?format=json → { url: signedUrl } for JS client (backward compatibility)
 * no param → STREAM the video from S3 through our server (proxy mode)
 */

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

/**
 * Extract S3 key from various URL formats:
 * - s3://bucket/key → key
 * - https://endpoint/bucket/key → key
 * - plain key (no protocol) → key
 * - non-S3 URL → null
 */
function extractS3Key(url: string): string | null {
  // Handle s3://bucket/key format (e.g. from S3 console)
  if (url.startsWith("s3://")) {
    const withoutProtocol = url.slice(5); // "ati-lab/knowledge/articles/01 SDD.mp4"
    const slashIndex = withoutProtocol.indexOf("/");
    if (slashIndex > 0) {
      return withoutProtocol.slice(slashIndex + 1); // "knowledge/articles/01 SDD.mp4"
    }
    // Invalid s3:// URI — no key after bucket
    return null;
  }

  const endpoint = process.env.S3_ENDPOINT || "";
  const bucket = process.env.S3_BUCKET_NAME || "";
  const prefix = `${endpoint}/${bucket}/`;

  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }

  // Already a key (no http prefix)
  if (!url.startsWith("http")) {
    return url;
  }

  // Not an S3 URL
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    // 1. Auth check
    const sessionResult = await getServerSession(authOptions);
    const session = sessionResult ?? undefined;
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Доступ запрещен. Необходима авторизация." },
        { status: 401 }
      );
    }

    // 2. Ensure fileKey column exists
    await ensureFileKeyColumn();

    // 3. Resolve articleId
    const { articleId } = await params;

    // 4. Try to find video in media table first
    const mediaResult = await pool.query(
      `SELECT id, "fileName", url, "fileKey"
       FROM media
       WHERE "articleId" = $1 AND "fileType" = 'video'
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      [articleId]
    );

    let s3Key: string | null = null;
    let directUrl: string | null = null;

    if (mediaResult.rows && mediaResult.rows.length > 0) {
      const media = mediaResult.rows[0];

      if (media.fileKey) {
        s3Key = media.fileKey;
      } else if (media.url) {
        const extracted = extractS3Key(media.url);
        if (extracted) {
          s3Key = extracted;
        } else {
          // Not an S3 URL — use directly
          directUrl = media.url;
        }
      }
    }

    // 5. If no media found, check article.videoUrl
    if (!s3Key && !directUrl) {
      const articleResult = await pool.query(
        `SELECT id, "videoUrl" FROM articles WHERE id = $1`,
        [articleId]
      );

      if (articleResult.rows && articleResult.rows.length > 0) {
        const article = articleResult.rows[0];

        if (article.videoUrl) {
          console.log(`[video/by-article] Article videoUrl: "${article.videoUrl}"`);
          const extracted = extractS3Key(article.videoUrl);
          console.log(`[video/by-article] Extracted S3 key: "${extracted}"`);
          if (extracted) {
            s3Key = extracted;
          } else {
            // Not an S3 URL (YouTube, Rutube, etc.) — use directly
            directUrl = article.videoUrl;
          }
        }
      }
    }

    // 6. Nothing found
    if (!s3Key && !directUrl) {
      return NextResponse.json(
        { error: "Видео не найдено для данной статьи" },
        { status: 404 }
      );
    }

    // 7. For non-S3 URLs (YouTube, Rutube, etc.) — redirect directly
    if (directUrl) {
      const format = request.nextUrl.searchParams.get("format");
      if (format === "json") {
        return NextResponse.json({ url: directUrl });
      }
      return NextResponse.redirect(directUrl);
    }

    // 8. S3 video — resolve key and stream
    console.log(`[video/by-article] Resolving S3 key: "${s3Key}"`);

    const resolved = await s3Provider.resolveKey(s3Key!);

    let actualKey: string;
    let fileSizeMB = 0;

    if (resolved) {
      actualKey = resolved.key;
      fileSizeMB = Math.round(resolved.size / 1024 / 1024);
      console.log(`[video/by-article] Key resolved: "${actualKey}" (${fileSizeMB}MB)`);

      // If the resolved key differs from what we had, update the DB for next time
      if (actualKey !== s3Key) {
        console.log(`[video/by-article] Key corrected: "${s3Key}" → "${actualKey}"`);
        try {
          await pool.query(
            `UPDATE articles SET "videoUrl" = $2 WHERE id = $1`,
            [articleId, actualKey]
          );
        } catch (updateErr) {
          console.warn('[video/by-article] Failed to update videoUrl in DB:', updateErr);
        }

        // Also update media.fileKey if media was found
        if (mediaResult.rows && mediaResult.rows.length > 0) {
          try {
            await pool.query(
              `UPDATE media SET "fileKey" = $2 WHERE id = $1`,
              [mediaResult.rows[0].id, actualKey]
            );
          } catch (updateErr) {
            console.warn('[video/by-article] Failed to update media fileKey in DB:', updateErr);
          }
        }
      }
    } else {
      // Key not found in S3 — try streaming with the original key as last resort
      console.warn(`[video/by-article] Key not found in S3, trying direct stream: "${s3Key}"`);
      actualKey = s3Key!;
    }

    // Backward compatibility: return signed URL as JSON
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);
      return NextResponse.json({ url: signedUrl });
    }

    // ── Streaming proxy mode (S3 only) ──────────────────────
    // Instead of generating a signed URL and then fetching it with Node.js fetch
    // (which causes issues with Cyrillic key encoding and ERR_CONNECTION_RESET),
    // we use AWS SDK GetObjectCommand directly to stream from S3.
    // This is much more reliable for files with Cyrillic/special characters.

    const rangeHeader = request.headers.get("Range");
    console.log(`[video/by-article] Streaming via SDK: "${actualKey}"${rangeHeader ? ` (Range: ${rangeHeader})` : ""}`);

    try {
      const s3Stream = await s3Provider.streamObject(actualKey, rangeHeader || undefined);

      // Build response headers
      const responseHeaders = new Headers();
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Content-Type", s3Stream.contentType || "video/mp4");
      responseHeaders.set("Content-Length", String(s3Stream.contentLength));

      if (s3Stream.contentRange) {
        responseHeaders.set("Content-Range", s3Stream.contentRange);
      }

      // Cache control — allow browser caching for 1 hour
      responseHeaders.set("Cache-Control", "private, max-age=3600");

      // Convert Node.js Readable to Web ReadableStream
      const webStream = Readable.toWeb(s3Stream.body as Readable) as ReadableStream;

      console.log(`[video/by-article] Streaming response: ${s3Stream.statusCode} Content-Length=${s3Stream.contentLength}${s3Stream.contentRange ? ` Range=${s3Stream.contentRange}` : ""}`);

      return new Response(webStream, {
        status: s3Stream.statusCode,
        headers: responseHeaders,
      });
    } catch (streamErr) {
      console.error(`[video/by-article] SDK stream failed for key "${actualKey}":`, streamErr);

      // Fallback: try signed URL + fetch as last resort
      console.log(`[video/by-article] Falling back to signed URL + fetch`);
      try {
        const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);

        const fetchHeaders: Record<string, string> = {};
        if (rangeHeader) {
          fetchHeaders["Range"] = rangeHeader;
        }

        const s3Response = await fetch(signedUrl, {
          headers: fetchHeaders,
          redirect: "follow",
        });

        if (!s3Response.ok && s3Response.status !== 206) {
          console.error(`[video/by-article] Fallback fetch also failed: ${s3Response.status}`);
          return NextResponse.json(
            { error: "Не удалось получить видео из хранилища", details: `S3 returned ${s3Response.status}` },
            { status: s3Response.status === 404 ? 404 : 502 }
          );
        }

        const responseHeaders = new Headers();
        responseHeaders.set("Accept-Ranges", "bytes");
        const contentType = s3Response.headers.get("Content-Type");
        responseHeaders.set("Content-Type", contentType || "video/mp4");
        const contentLength = s3Response.headers.get("Content-Length");
        if (contentLength) responseHeaders.set("Content-Length", contentLength);
        const contentRange = s3Response.headers.get("Content-Range");
        if (contentRange) responseHeaders.set("Content-Range", contentRange);
        responseHeaders.set("Cache-Control", "private, max-age=3600");

        const status = s3Response.status === 206 ? 206 : 200;

        return new Response(s3Response.body, {
          status,
          headers: responseHeaders,
        });
      } catch (fallbackErr) {
        console.error(`[video/by-article] Both streaming methods failed:`, fallbackErr);
        return NextResponse.json(
          { error: "Не удалось получить видео из хранилища", details: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) },
          { status: 502 }
        );
      }
    }
  } catch (error) {
    console.error("[video/by-article] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
