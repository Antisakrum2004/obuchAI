import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/video/update-tunnel
 *
 * Webhook для динамического обновления URL медиа-сервера (Serveo туннель).
 * Локальный скрипт автоматизации вызывает этот эндпоинт при получении нового URL.
 *
 * Параметры (query или body JSON):
 *   - url: string   — новый базовый URL медиа-сервера
 *   - secret: string — токен авторизации
 *
 * Логика:
 *   1. Проверить secret === WEBHOOK_SECRET (env) или хардкод
 *   2. Сохранить URL в таблицу app_settings по ключу "media_server_url"
 *   3. Вернуть {"status": "success", "updatedTo": url}
 *
 * Если в таблице нет строки — она создаётся (INSERT).
 * Если есть — обновляется (upsert).
 */
export async function POST(request: NextRequest) {
  // Parse parameters from body or query
  let url: string | null = null;
  let secret: string | null = null;

  try {
    const body = await request.json();
    url = body.url || null;
    secret = body.secret || null;
  } catch {
    // Body not JSON — try query params
  }

  if (!url || !secret) {
    const params = request.nextUrl.searchParams;
    url = url || params.get("url");
    secret = secret || params.get("secret");
  }

  if (!url) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }
  if (!secret) {
    return NextResponse.json({ error: "Missing 'secret' parameter" }, { status: 400 });
  }

  // Validate secret — env var takes priority, hardcoded as fallback
  const validSecret = process.env.WEBHOOK_SECRET || "my_super_secret_123";
  if (secret !== validSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) {
      return NextResponse.json({ error: "URL must start with http:// or https://" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // Save to app_settings using upsert (raw SQL)
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, "updatedAt")
       VALUES ('media_server_url', $1, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $1, "updatedAt" = NOW()`,
      [url]
    );

    console.log(`[update-tunnel] Media server URL updated to: ${url}`);
    return NextResponse.json({ status: "success", updatedTo: url });
  } catch (err) {
    console.error("[update-tunnel] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to save URL to database" }, { status: 500 });
  }
}

/**
 * GET /api/video/update-tunnel
 *
 * Возвращает текущий сохранённый URL медиа-сервера (для диагностики).
 * Также требует secret.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const validSecret = process.env.WEBHOOK_SECRET || "my_super_secret_123";

  if (secret !== validSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT value, "updatedAt" FROM app_settings WHERE key = 'media_server_url'`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        url: null,
        fallback: process.env.MEDIA_SERVER_URL || null,
        message: "No dynamic URL saved, using env fallback",
      });
    }

    return NextResponse.json({
      url: result.rows[0].value,
      updatedAt: result.rows[0].updatedAt,
    });
  } catch (err) {
    console.error("[update-tunnel] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to read URL from database" }, { status: 500 });
  }
}
