import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/rollback-v041
 *
 * One-time rollback: removes columns and data added by v0.41.0.
 * Requires webhook secret for authorization.
 */
export async function POST(request: NextRequest) {
  // Auth check: webhook secret in body
  let authorized = false;
  try {
    const body = await request.json();
    const validSecret = process.env.WEBHOOK_SECRET || "my_super_secret_123";
    if (body.secret === validSecret) authorized = true;
  } catch {}

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // 1. Drop cheat_sheet column from articles table (if exists)
  try {
    await pool.query(`ALTER TABLE articles DROP COLUMN IF EXISTS "cheat_sheet"`);
    results.push("✓ Dropped column articles.cheat_sheet");
  } catch (err) {
    results.push(`✗ Failed to drop articles.cheat_sheet: ${err instanceof Error ? err.message : err}`);
  }

  // 2. Drop media_folder column from knowledge_spaces table (if exists)
  try {
    await pool.query(`ALTER TABLE knowledge_spaces DROP COLUMN IF EXISTS "media_folder"`);
    results.push("✓ Dropped column knowledge_spaces.media_folder");
  } catch (err) {
    results.push(`✗ Failed to drop knowledge_spaces.media_folder: ${err instanceof Error ? err.message : err}`);
  }

  // 3. Delete test/duplicate knowledge spaces created by sync-folders
  //    (slug 'филиппов' was a duplicate of 'курс-филиппова')
  try {
    const delResult = await pool.query(`
      DELETE FROM knowledge_spaces
      WHERE slug IN ('филиппов', 'testcourse1', 'testcourse2', 'новый-курс-1с')
    `);
    results.push(`✓ Cleaned up ${delResult.rowCount} test/duplicate knowledge_spaces`);
  } catch (err) {
    results.push(`✗ Failed to clean up test spaces: ${err instanceof Error ? err.message : err}`);
  }

  // 4. Delete any cheat_sheet records from app_settings (if used there)
  try {
    const delSettings = await pool.query(`
      DELETE FROM app_settings WHERE key = 'cheat_sheet'
    `);
    results.push(`✓ Cleaned up ${delSettings.rowCount} cheat_sheet app_settings`);
  } catch (err) {
    results.push(`✗ Failed to clean app_settings: ${err instanceof Error ? err.message : err}`);
  }

  // 5. Report current state of knowledge_spaces
  try {
    const state = await pool.query(
      `SELECT id, name, slug, "isPublished" FROM knowledge_spaces ORDER BY "order" ASC`
    );
    return NextResponse.json({
      rollback: results,
      remainingSpaces: state.rows,
    });
  } catch (err) {
    return NextResponse.json({
      rollback: results,
      error: "Could not fetch remaining spaces",
    });
  }
}
