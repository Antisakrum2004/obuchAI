import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * GET /api/knowledge/video/by-article/[articleId]
 *
 * Returns a signed S3 URL for the video of an article.
 * Searches in TWO places:
 * 1. media table (uploaded video attachments)
 * 2. article.videoUrl field (URL set directly on the article)
 *
 * This is needed because videos can be set either:
 * - As media attachments (uploaded via MediaUpload component)
 * - As article.videoUrl (set via admin URL import or manual edit)
 *
 * ?format=json → { url: signedUrl } for JS client (more reliable than 302 redirect)
 * no param → 302 redirect (backward compatibility)
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

    // 7. Generate signed URL or use direct URL
    let videoUrl: string;

    if (s3Key) {
      console.log(`[video/by-article] Generating signed URL for key: "${s3Key}"`);
      videoUrl = await s3Provider.getSignedUrl(s3Key, 900);
      console.log(`[video/by-article] Signed URL generated (length: ${videoUrl.length})`);
    } else {
      videoUrl = directUrl!;
    }

    // 8. Return result
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: videoUrl });
    }

    return NextResponse.redirect(videoUrl);
  } catch (error) {
    console.error("[video/by-article] Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
