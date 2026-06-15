import { pool } from "@/lib/db";

/**
 * Resolves the current media server URL.
 *
 * Priority:
 *   1. Dynamic URL from app_settings (key = "media_server_url") — updated via /api/video/update-tunnel webhook
 *   2. Fallback: process.env.MEDIA_SERVER_URL
 *
 * Returns null if neither source provides a URL.
 */
export async function getMediaServerUrl(): Promise<string | null> {
  // 1. Try DB first (dynamically updated via webhook)
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'media_server_url'`
    );
    if (result.rows.length > 0 && result.rows[0].value) {
      return result.rows[0].value;
    }
  } catch {
    // DB not available — fall through to env var
  }

  // 2. Fallback to env var
  return process.env.MEDIA_SERVER_URL || null;
}
