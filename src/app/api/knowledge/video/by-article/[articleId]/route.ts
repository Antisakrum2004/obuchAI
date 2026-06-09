import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * GET /api/knowledge/video/by-article/[articleId]
 *
 * Streams video from S3. Two modes:
 * 1. Default → 302 redirect to signed S3 URL (browser streams directly from S3)
 * 2. ?format=json → returns signed URL as JSON
 *
 * Signed URLs are cleaned of x-amz-checksum-mode=ENABLED which Selectel doesn't support.
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
 * Extract S3 key from various URL formats
 */
function extractS3Key(url: string): string | null {
  if (url.startsWith("s3://")) {
    const withoutProtocol = url.slice(5);
    const slashIndex = withoutProtocol.indexOf("/");
    if (slashIndex > 0) {
      return withoutProtocol.slice(slashIndex + 1);
    }
    return null;
  }

  const endpoint = process.env.S3_ENDPOINT || "";
  const bucket = process.env.S3_BUCKET_NAME || "";
  const prefix = `${endpoint}/${bucket}/`;

  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }

  if (!url.startsWith("http")) {
    return url;
  }

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
          const extracted = extractS3Key(article.videoUrl);
          if (extracted) {
            s3Key = extracted;
          } else {
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

    // 8. S3 video — resolve key
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
      console.warn(`[video/by-article] Key not found in S3, trying signed URL: "${s3Key}"`);
      actualKey = s3Key!;
    }

    // 9. Generate signed URL (with x-amz-checksum-mode stripped by getSignedUrl)
    const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);
    console.log(`[video/by-article] Signed URL generated for "${actualKey}" (${fileSizeMB}MB)`);

    // Return format
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    // 302 redirect to signed URL — browser streams directly from S3
    // This is the only reliable way on Vercel serverless (no streaming 500MB through server)
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[video/by-article] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
