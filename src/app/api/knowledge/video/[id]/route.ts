import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * GET /api/knowledge/video/[id]
 *
 * Защищённый API-маршрут для стриминга видео из приватного S3 (Selectel).
 *
 * Логика:
 * 1. Проверка авторизации через getServerSession (defensive destructuring)
 * 2. Runtime migration: убедиться что колонка fileKey существует
 * 3. Raw SQL запрос к media — достаём file_key (или url) по id
 * 4. Генерация Signed URL через @aws-sdk/s3-request-presigner (expiresIn: 900 = 15 мин)
 * 5. ?format=json → { url: signedUrl } для JS-клиента (надёжнее, чем 302 редирект)
 *    без параметра → 302 редирект на Signed URL
 */

// Singleton S3StorageProvider для генерации Signed URLs
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
    // ── 1. Проверка авторизации (defensive destructuring) ──────────
    const sessionResult = await getServerSession(authOptions);
    const session = sessionResult ?? undefined;
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Доступ запрещен. Необходима авторизация." },
        { status: 401 }
      );
    }

    // ── 2. Ensure fileKey column exists ────────────────────────────
    await ensureFileKeyColumn();

    // ── 3. Получаем file_key видео из БД (raw SQL) ─────────────────
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
      // Fallback: извлекаем ключ из URL формата
      // https://s3.ru-7.storage.selcloud.ru/ati-lab/knowledge/...
      // → knowledge/...
      const url = media.url as string;

      if (!url) {
        return NextResponse.json(
          { error: "У видео отсутствует ссылка на файл" },
          { status: 500 }
        );
      }

      // Проверяем, что URL принадлежит нашему S3 хранилищу
      const endpoint = process.env.S3_ENDPOINT || "";
      const bucket = process.env.S3_BUCKET_NAME || "";
      const prefix = `${endpoint}/${bucket}/`;

      if (url.startsWith("s3://")) {
        // Handle s3://bucket/key format (e.g. from S3 console)
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
        // Уже ключ (не URL)
        s3Key = url;
      } else {
        // URL не из нашего S3 — возможно это старый Vercel Blob URL
        // В этом случае просто редиректим на оригинальный URL
        console.warn(
          `[video/${id}] URL не из S3, перенаправление на оригинал:`,
          url
        );
        return NextResponse.redirect(url);
      }
    }

    // ── 4. Генерация Signed URL (15 минут) ──────────────────────────
    const signedUrl = await s3Provider.getSignedUrl(s3Key, 900);

    // ── 5. Return signed URL ────────────────────────────────────────
    // ?format=json → { url: signedUrl } для JS-клиента (надёжнее, чем 302 редирект)
    // без параметра → 302 редирект (обратная совместимость)
    const format = request.nextUrl.searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ url: signedUrl });
    }

    // HTML5 <video src="/api/knowledge/video/xxx"> → 302 → signed S3 URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[video/[id]] Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Ошибка генерации ссылки на видео", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
