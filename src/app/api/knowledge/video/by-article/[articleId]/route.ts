import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import { extractS3Key } from "@/lib/storage/s3-key-parser";

/**
 * GET /api/knowledge/video/by-article/[articleId]
 *
 * Возвращает Signed URL для видео статьи из приватного S3-хранилища.
 *
 * ВАЖНО: Этот роут НЕ скачивает и НЕ стримит видео через себя.
 * Он ТОЛЬКО генерирует подписанную ссылку и отдаёт её клиенту:
 *   - Без параметров → 302 редирект на signed URL
 *   - ?format=json   → JSON { url: "signedUrl" }
 *
 * Браузер сотрудника качает видео НАПРЯМУЮ из Selectel,
 * минуя сервера Vercel/AWS — это экономит трафик Selectel.
 */

const s3Provider = new S3StorageProvider();

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

    // 2. Resolve articleId
    const { articleId } = await params;
    console.log(`[by-article] Request for articleId="${articleId}"`);

    // 3. Try to find video in media table first
    const mediaResult = await pool.query(
      `SELECT id, "fileName", url, "fileKey", "articleId"
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
      console.log(`[by-article] Found media record:`, JSON.stringify({
        id: media.id,
        fileName: media.fileName,
        url: media.url,
        fileKey: media.fileKey,
        articleId: media.articleId,
      }));

      // extractS3Key жёстко парсит все форматы: s3://, https://, чистый ключ
      if (media.fileKey) {
        s3Key = extractS3Key(media.fileKey);
      }
      if (!s3Key && media.url) {
        s3Key = extractS3Key(media.url);
      }
      // Если extractS3Key вернул null — значит URL не наш S3 (YouTube и т.д.)
      if (!s3Key && media.url) {
        directUrl = media.url;
      }

      // ── Автоисправление: если ключ содержит пробелы и не заканчивается на расширение ──
      if (s3Key && s3Key.includes(" ") && !s3Key.match(/\.\w{2,4}$/)) {
        const fixedKey = s3Key.replace(/\s+/g, "") + ".mp4";
        console.log(`[by-article] AUTO-FIX: Key "${s3Key}" looks broken. Updating DB to "${fixedKey}"`);
        try {
          await pool.query(
            `UPDATE media SET "fileKey" = $1 WHERE id = $2`,
            [fixedKey, media.id]
          );
          s3Key = fixedKey;
        } catch (dbErr) {
          console.error(`[by-article] AUTO-FIX failed:`, dbErr);
        }
      }
    } else {
      console.log(`[by-article] No media found for articleId="${articleId}"`);
    }

    // 4. If no media found, check article.videoUrl
    if (!s3Key && !directUrl) {
      const articleResult = await pool.query(
        `SELECT id, "videoUrl" FROM articles WHERE id = $1`,
        [articleId]
      );

      if (articleResult.rows && articleResult.rows.length > 0) {
        const article = articleResult.rows[0];
        console.log(`[by-article] Fallback to article.videoUrl="${article.videoUrl}"`);

        if (article.videoUrl) {
          s3Key = extractS3Key(article.videoUrl);
          if (!s3Key) {
            directUrl = article.videoUrl;
          }
        }
      }
    }

    // 5. Nothing found
    if (!s3Key && !directUrl) {
      console.log(`[by-article] No video found for articleId="${articleId}" — neither in media nor in article.videoUrl`);
      return NextResponse.json(
        { error: "Видео не найдено для данной статьи", articleId },
        { status: 404 }
      );
    }

    // 6. For non-S3 URLs (YouTube, Rutube, etc.) — redirect directly
    if (directUrl && !s3Key) {
      return respondWithUrl(directUrl, request);
    }

    // 7. S3 video — generate signed URL (pure computation, NO S3 API calls)
    console.log(`[by-article] articleId="${articleId}" | Parsed Key="${s3Key}"`);
    const signedUrl = await s3Provider.getSignedUrl(s3Key!, 3600);
    console.log(`[by-article] articleId="${articleId}" | Signed URL (first 120): "${signedUrl.substring(0, 120)}..."`);

    return respondWithUrl(signedUrl, request);
  } catch (error) {
    console.error("[video/by-article] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Отдаёт URL клиенту: JSON или 302 редирект
 */
function respondWithUrl(url: string, request: NextRequest): NextResponse {
  const format = request.nextUrl.searchParams.get("format");
  if (format === "json") {
    return NextResponse.json({ url });
  }
  return NextResponse.redirect(url, { status: 302 });
}
