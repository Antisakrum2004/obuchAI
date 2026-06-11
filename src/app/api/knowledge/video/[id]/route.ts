import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import { extractS3Key } from "@/lib/storage/s3-key-parser";

/**
 * GET /api/knowledge/video/[id]
 *
 * Возвращает Signed URL для видео из приватного S3-хранилища.
 *
 * ВАЖНО: Этот роут НЕ скачивает и НЕ стримит видео через себя.
 * Он ТОЛЬКО генерирует подписанную ссылку и отдаёт её клиенту:
 *   - Без параметров → 302 редирект на signed URL
 *   - ?format=json   → JSON { url: "signedUrl" }
 *
 * Браузер сотрудника качает видео НАПРЯМУЮ из Selectel,
 * минуя сервера Vercel/AWS — это экономит трафик Selectel.
 *
 * Signed URLs генерируются вручную (AWS Sig V4) без x-amz-checksum-mode,
 * который Selectel не поддерживает (ERR_CONNECTION_RESET).
 *
 * Маршрутизация ID:
 *   - Если ID совпадает с media.id → берём ключ из media.fileKey / media.url
 *   - Если ID совпадает с media."articleId" → берём первую видео-запись
 *   - Если ничего не найдено → проверяем article.videoUrl как fallback
 */

const s3Provider = new S3StorageProvider();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Авторизация ──
    const sessionResult = await getServerSession(authOptions);
    const session = sessionResult ?? undefined;
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Доступ запрещен. Необходима авторизация." },
        { status: 401 }
      );
    }

    const { id } = await params;

    console.log(`[video/[id]] Request for id="${id}"`);

    // ── 2. Попытка 1: Ищем в media по media.id ──
    const directResult = await pool.query(
      `SELECT id, "fileName", "mimeType", "fileType", url, "fileKey", "articleId"
       FROM media
       WHERE id = $1`,
      [id]
    );

    if (directResult.rows && directResult.rows.length > 0) {
      const media = directResult.rows[0];
      console.log(`[video/[id]] Found by media.id | record:`, JSON.stringify({
        id: media.id,
        fileName: media.fileName,
        fileType: media.fileType,
        url: media.url,
        fileKey: media.fileKey,
        articleId: media.articleId,
      }));

      // Проверяем что это видео (или нет файла другого типа)
      if (media.fileType && media.fileType !== "video") {
        return NextResponse.json(
          { error: `Запрошенный файл имеет тип "${media.fileType}", а не "video"` },
          { status: 400 }
        );
      }

      return await resolveAndSign(media, id, request);
    }

    // ── 3. Попытка 2: Ищем в media по articleId (ID мог быть article ID) ──
    const byArticleResult = await pool.query(
      `SELECT id, "fileName", "mimeType", "fileType", url, "fileKey", "articleId"
       FROM media
       WHERE "articleId" = $1 AND "fileType" = 'video'
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      [id]
    );

    if (byArticleResult.rows && byArticleResult.rows.length > 0) {
      const media = byArticleResult.rows[0];
      console.log(`[video/[id]] Found by articleId | record:`, JSON.stringify({
        id: media.id,
        fileName: media.fileName,
        fileType: media.fileType,
        url: media.url,
        fileKey: media.fileKey,
        articleId: media.articleId,
      }));

      return await resolveAndSign(media, id, request);
    }

    // ── 4. Попытка 3: Проверяем article.videoUrl как fallback ──
    const articleResult = await pool.query(
      `SELECT id, "videoUrl" FROM articles WHERE id = $1`,
      [id]
    );

    if (articleResult.rows && articleResult.rows.length > 0) {
      const article = articleResult.rows[0];
      console.log(`[video/[id]] No media found, checking article.videoUrl | articleId="${article.id}" | videoUrl="${article.videoUrl}"`);

      if (article.videoUrl) {
        const s3Key = extractS3Key(article.videoUrl);
        if (s3Key) {
          console.log(`[video/[id]] Using article.videoUrl | Parsed Key="${s3Key}"`);
          const signedUrl = await s3Provider.getSignedUrl(s3Key, 3600);
          console.log(`[video/[id]] Signed URL generated (first 120 chars): "${signedUrl.substring(0, 120)}..."`);
          return respondWithUrl(signedUrl, request);
        }

        // article.videoUrl — не S3 (YouTube и т.д.)
        return respondWithUrl(article.videoUrl, request);
      }
    }

    // ── 5. Ничего не найдено ──
    console.log(`[video/[id]] No record found for id="${id}" — not in media.id, not in media.articleId, not in articles.videoUrl`);
    return NextResponse.json(
      { error: "Видео не найдено", requestedId: id },
      { status: 404 }
    );
  } catch (error) {
    console.error("[video/[id]] Error:", error);
    return NextResponse.json(
      {
        error: "Ошибка генерации ссылки на видео",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Разрешает S3-ключ из записи media и генерирует Signed URL.
 * Если в БД устаревший ключ (старое имя файла) — обновляет запись.
 */
async function resolveAndSign(
  media: { id: string; fileName: string; url: string; fileKey: string | null; articleId: string | null },
  requestedId: string,
  request: NextRequest
): Promise<NextResponse> {
  // Приоритет: fileKey → url
  let s3Key: string | null = null;

  if (media.fileKey) {
    s3Key = extractS3Key(media.fileKey);
  }

  if (!s3Key && media.url) {
    s3Key = extractS3Key(media.url);
  }

  if (!s3Key) {
    // URL не из нашего S3 — перенаправляем напрямую (YouTube, Rutube и т.д.)
    if (media.url && media.url.startsWith("http")) {
      return respondWithUrl(media.url, request);
    }
    return NextResponse.json(
      { error: "У видео отсутствует ключ файла в S3", mediaId: media.id, fileKey: media.fileKey, url: media.url },
      { status: 500 }
    );
  }

  // Диагностика: логируем распарсенный ключ
  console.log(`[video/[id]] id="${requestedId}" | fileKey="${media.fileKey}" | url="${media.url}" | Parsed Key="${s3Key}"`);

  // ── Автоисправление: если ключ содержит пробелы и не заканчивается на .mp4/.webm/.mov,
  //    обновляем запись на корректный ключ (файл в Selectel уже переименован) ──
  if (s3Key.includes(" ") && !s3Key.match(/\.\w{2,4}$/)) {
    const fixedKey = s3Key.replace(/\s+/g, "") + ".mp4";
    console.log(`[video/[id]] AUTO-FIX: Key "${s3Key}" looks broken (spaces, no extension). Updating DB to "${fixedKey}"`);

    try {
      await pool.query(
        `UPDATE media SET "fileKey" = $1 WHERE id = $2`,
        [fixedKey, media.id]
      );
      s3Key = fixedKey;
    } catch (dbErr) {
      console.error(`[video/[id]] AUTO-FIX failed:`, dbErr);
    }
  }

  // Генерируем Signed URL (чистая криптография, без сети)
  const signedUrl = await s3Provider.getSignedUrl(s3Key, 3600);

  console.log(`[video/[id]] id="${requestedId}" | Signed URL generated (first 120 chars): "${signedUrl.substring(0, 120)}..."`);

  return respondWithUrl(signedUrl, request);
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
