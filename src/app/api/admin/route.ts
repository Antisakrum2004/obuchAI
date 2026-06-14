import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin - Overview stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    // Use individual queries with fallbacks so one missing table doesn't break everything
    let totalUsers = 0;
    let totalChallenges = 0;
    let totalAttempts = 0;
    let totalXpLogs = 0;
    let todayAttempts = 0;
    let recentUsers: unknown[] = [];

    try {
      const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM users`);
      totalUsers = r.rows[0]?.cnt || 0;
    } catch { /* table might not exist yet */ }

    try {
      const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM challenges`);
      totalChallenges = r.rows[0]?.cnt || 0;
    } catch { /* table might not exist yet */ }

    try {
      const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM challenge_attempts`);
      totalAttempts = r.rows[0]?.cnt || 0;
    } catch { /* table might not exist yet */ }

    try {
      const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM xp_logs`);
      totalXpLogs = r.rows[0]?.cnt || 0;
    } catch { /* table might not exist yet */ }

    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM challenge_attempts WHERE "createdAt" >= $1`,
        [new Date(new Date().setHours(0, 0, 0, 0)).toISOString()]
      );
      todayAttempts = r.rows[0]?.cnt || 0;
    } catch { /* table might not exist yet */ }

    try {
      const r = await pool.query(
        `SELECT id, name, email, xp, level, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 5`
      );
      recentUsers = r.rows;
    } catch { /* table might not exist yet */ }

    return NextResponse.json({
      totalUsers,
      totalChallenges,
      totalAttempts,
      totalXpLogs,
      todayAttempts,
      recentUsers,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера", detail: String(error) },
      { status: 500 }
    );
  }
}
