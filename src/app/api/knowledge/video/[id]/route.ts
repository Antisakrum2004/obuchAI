import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

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
  const endpoint = process.env.S3_ENDPOINT || "";
  const bucket = process.env.S3_BUCKET_NAME || "";
  const prefix = `${endpoint}/${bucket}/`;

  if (url.startsWith("s3://")) {
    const withoutProtocol = url.slice(5);
    const slashIndex = withoutProtocol.indexOf("/");
    if (slashIndex > 0) {
      return withoutProtocol.slice(slashIndex + 1);
    }
    return null;
  }

  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }

  // Если это не URL (нет http), считаем что это уже ключ
  if (!url.startsWith("http")) {
    return url;
  }

  // URL не из нашего S3
  return null;
}

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

    // ── 2. Получаем ключ файла из БД ──
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

    // ── 3. Определяем S3-ключ ──
    // Приоритет: fileKey из БД → извлечение из url
    let s3Key: string | null = null;

    if (media.fileKey) {
      s3Key = media.fileKey;
    } else if (media.url) {
      s3Key = extractS3Key(media.url);
    }

    if (!s3Key) {
      // URL не из нашего S3 — перенаправляем напрямую
      if (media.url && media.url.startsWith("http")) {
        return NextResponse.redirect(media.url);
      }
      return NextResponse.json(
        { error: "У видео отсутствует ключ файла в S3" },
        { status: 500 }
      );
    }

    // ── 4. Генерируем Signed URL (чистая криптография, без сети) ──
    const signedUrl = await s3Provider.getSignedUrl(s3Key, 3600);

    // ── 5. Отдаём результат ──
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    // Жёсткий 302 редирект — браузер качает напрямую из Selectel
    return NextResponse.redirect(signedUrl, { status: 302 });
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
