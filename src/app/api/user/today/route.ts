import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Tasks solved today
    const solvedResult = await query(
      `SELECT COUNT(*) as count, COALESCE(SUM("xpEarned"), 0) as xp FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true AND "createdAt" >= $2`,
      [userId, todayStart]
    );
    const solvedToday = Number(solvedResult.rows[0]?.count || 0);
    const xpToday = Number(solvedResult.rows[0]?.xp || 0);

    // Articles read today (using article_views if it exists, otherwise 0)
    let articlesReadToday = 0;
    try {
      const articlesResult = await query(
        `SELECT COUNT(*) as count FROM article_views WHERE "userId" = $1 AND "viewedAt" >= $2`,
        [userId, todayStart]
      );
      articlesReadToday = Number(articlesResult.rows[0]?.count || 0);
    } catch {
      // table might not exist yet
      articlesReadToday = 0;
    }

    // Last 3 activities for timeline
    const recentResult = await query(
      `SELECT ca."isCorrect", ca."xpEarned", ca."createdAt", c.title as "challengeTitle"
       FROM challenge_attempts ca
       LEFT JOIN challenges c ON c.id = ca."challengeId"
       WHERE ca."userId" = $1
       ORDER BY ca."createdAt" DESC
       LIMIT 5`,
      [userId]
    );

    const timeline = recentResult.rows.map((row: Record<string, unknown>) => ({
      type: row.isCorrect ? "solved" : "attempted",
      title: row.challengeTitle || "Задача",
      xp: Number(row.xpEarned || 0),
      time: row.createdAt as string,
    }));

    return NextResponse.json({
      solvedToday,
      xpToday,
      articlesReadToday,
      timeline,
    });
  } catch (error) {
    console.error("Today stats error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
