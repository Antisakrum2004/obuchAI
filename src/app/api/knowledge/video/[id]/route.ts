import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * GET /api/knowledge/video/[id]
 *
 * Video streaming by media ID.
 * Default → 302 redirect to signed S3 URL
 * ?format=json → returns signed URL as JSON
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getServerSession(authOptions);
    const session = sessionResult ?? undefined;
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Доступ запрещен. Необходима авторизация." },
        { status: 401 }
      );
    }

    await ensureFileKeyColumn();

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
        console.warn(`[video/${id}] URL не из S3, перенаправление:`, url);
        return NextResponse.redirect(url);
      }
    }

    // Resolve key
    const resolved = await s3Provider.resolveKey(s3Key);

    let actualKey = s3Key;

    if (resolved) {
      actualKey = resolved.key;
      const fileSizeMB = Math.round(resolved.size / 1024 / 1024);
      console.log(`[video/${id}] Key resolved: "${actualKey}" (${fileSizeMB}MB)`);

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

    // Generate signed URL (with x-amz-checksum-mode stripped)
    const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);

    // Return format
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    // 302 redirect to signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[video/[id]] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
