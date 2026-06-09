import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

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

/**
 * Извлечь S3-ключ из URL, хранящегося в БД.
 * Поддерживаемые форматы:
 *   - s3://bucket/key
 *   - https://endpoint/bucket/key
 *   - plain key (knowledge/...)
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

    // 2. Resolve articleId
    const { articleId } = await params;

    // 3. Try to find video in media table first
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

    // 4. If no media found, check article.videoUrl
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

    // 5. Nothing found
    if (!s3Key && !directUrl) {
      return NextResponse.json(
        { error: "Видео не найдено для данной статьи" },
        { status: 404 }
      );
    }

    // 6. For non-S3 URLs (YouTube, Rutube, etc.) — redirect directly
    if (directUrl) {
      const format = request.nextUrl.searchParams.get("format");
      if (format === "json") {
        return NextResponse.json({ url: directUrl });
      }
      return NextResponse.redirect(directUrl);
    }

    // 7. S3 video — generate signed URL (pure computation, NO S3 API calls)
    const signedUrl = await s3Provider.getSignedUrl(s3Key!, 3600);

    // Return format
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    // 302 redirect — browser streams directly from Selectel
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    console.error("[video/by-article] Error:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
