import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  local_videos_title: "Платные курсы",
  local_videos_description: "Практические видеокурсы по AI-интеграции и автоматизации 1С",
};

/**
 * GET /api/video/settings
 *
 * Returns the current title and description for the local-videos section.
 * Reads from app_settings; falls back to hardcoded defaults.
 * No auth required — all users see the same title/description.
 */
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('local_videos_title', 'local_videos_description')`
    );

    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of result.rows) {
      if (row.value) {
        settings[row.key] = row.value;
      }
    }

    return NextResponse.json({
      title: settings.local_videos_title,
      description: settings.local_videos_description,
    });
  } catch (err) {
    console.error("[video/settings] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ...DEFAULTS });
  }
}

/**
 * PUT /api/video/settings
 *
 * Admin-only endpoint to update the title and/or description.
 * Requires admin session (checked via next-auth JWT).
 *
 * Body: { title?: string, description?: string }
 */
export async function PUT(request: NextRequest) {
  // Admin check via JWT
  const { getToken } = await import("next-auth/jwt");
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token || token.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized — admin only" }, { status: 403 });
  }

  let title: string | undefined;
  let description: string | undefined;

  try {
    const body = await request.json();
    title = body.title;
    description = body.description;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (title === undefined && description === undefined) {
    return NextResponse.json({ error: "Provide at least 'title' or 'description'" }, { status: 400 });
  }

  try {
    // Upsert title
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
      }
      await pool.query(
        `INSERT INTO app_settings (key, value, "updatedAt")
         VALUES ('local_videos_title', $1, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $1, "updatedAt" = NOW()`,
        [title.trim()]
      );
    }

    // Upsert description
    if (description !== undefined) {
      if (typeof description !== "string") {
        return NextResponse.json({ error: "Description must be a string" }, { status: 400 });
      }
      await pool.query(
        `INSERT INTO app_settings (key, value, "updatedAt")
         VALUES ('local_videos_description', $1, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $1, "updatedAt" = NOW()`,
        [description.trim()]
      );
    }

    console.log(`[video/settings] Updated: title=${title ?? '(unchanged)'}, description=${description ?? '(unchanged)'}`);
    return NextResponse.json({
      status: "success",
      title: title !== undefined ? title.trim() : undefined,
      description: description !== undefined ? description.trim() : undefined,
    });
  } catch (err) {
    console.error("[video/settings] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
