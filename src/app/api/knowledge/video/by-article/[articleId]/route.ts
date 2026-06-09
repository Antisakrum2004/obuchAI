import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * GET /api/knowledge/video/by-article/[articleId]
 *
 * Returns a signed S3 URL for the first video media of an article.
 * Used by VideoEmbed on the article page — the S3 bucket is private,
 * so direct URLs return 403. This route generates a 15-min presigned URL.
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

    // 3. Find the first video media for this article
    const { articleId } = await params;

    const result = await pool.query(
      `SELECT id, "fileName", url, "fileKey"
       FROM media
       WHERE "articleId" = $1 AND "fileType" = 'video'
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      [articleId]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: "Видео не найдено для данной статьи" },
        { status: 404 }
      );
    }

    const media = result.rows[0];

    // 4. Determine S3 key
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

      if (url.startsWith(prefix)) {
        s3Key = url.slice(prefix.length);
      } else if (!url.startsWith("http")) {
        s3Key = url;
      } else {
        // Not an S3 URL — redirect directly
        const format = request.nextUrl.searchParams.get("format");
        if (format === "json") {
          return NextResponse.json({ url });
        }
        return NextResponse.redirect(url);
      }
    }

    // 5. Generate signed URL (15 min)
    const signedUrl = await s3Provider.getSignedUrl(s3Key, 900);

    // 6. Return signed URL
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[video/by-article] Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
