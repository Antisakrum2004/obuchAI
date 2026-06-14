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

    // Get XP per day for last 7 days (for weekly chart)
    const xpByDay: number[] = [];
    const activeDays: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const result = await query(
        `SELECT COALESCE(SUM("xpEarned"), 0) as total FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true AND "createdAt" >= $2 AND "createdAt" < $3`,
        [userId, date, nextDate]
      );

      const total = Number(result.rows[0]?.total || 0);
      xpByDay.push(total);
      if (total > 0) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        activeDays.push(`${y}-${m}-${d}`);
      }
    }

    // Get activity data for heatmap (last 12 weeks = 84 days)
    const HEATMAP_WEEKS = 12;
    const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
    const heatmapStart = new Date();
    heatmapStart.setHours(0, 0, 0, 0);
    heatmapStart.setDate(heatmapStart.getDate() - HEATMAP_DAYS + 1);

    const heatmapResult = await query(
      `SELECT DATE("createdAt") as day, COUNT(*) as attempts, SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END) as correct
       FROM challenge_attempts
       WHERE "userId" = $1 AND "createdAt" >= $2
       GROUP BY DATE("createdAt")
       ORDER BY day`,
      [userId, heatmapStart]
    );

    // Build a map of date string -> activity level (0-4)
    const activityMap = new Map<string, number>();
    for (const row of heatmapResult.rows) {
      const dayStr = String(row.day); // YYYY-MM-DD or Date object
      const correct = Number(row.correct || 0);
      let level = 0;
      if (correct >= 5) level = 4;
      else if (correct >= 3) level = 3;
      else if (correct >= 2) level = 2;
      else if (correct >= 1) level = 1;
      activityMap.set(dayStr, level);
    }

    // Convert to 2D array: weeks[week][day] where day 0=Sun, 6=Sat
    const heatmapData: number[][] = [];
    // Align to start from Sunday
    const startDate = new Date(heatmapStart);
    const startDayOfWeek = startDate.getDay(); // 0=Sun
    const alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() - startDayOfWeek);

    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const week: number[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(alignedStart);
        cellDate.setDate(cellDate.getDate() + w * 7 + d);
        const y = cellDate.getFullYear();
        const m = String(cellDate.getMonth() + 1).padStart(2, "0");
        const day = String(cellDate.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${day}`;
        week.push(activityMap.get(key) ?? 0);
      }
      heatmapData.push(week);
    }

    // Get hearts info: 3 hearts, lose 1 per wrong answer in last 30 min, regen 1 every 30 min
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const wrongResult = await query(
      `SELECT COUNT(*) as count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = false AND "createdAt" >= $2`,
      [userId, thirtyMinAgo]
    );
    const wrongCount = Number(wrongResult.rows[0]?.count || 0);
    const hearts = Math.max(0, 3 - wrongCount);
    const nextHeartAt = hearts < 3 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

    return NextResponse.json({
      weeklyXp: xpByDay,
      activeDays,
      hearts,
      nextHeartAt,
      heatmapData,
    });
  } catch (error) {
    console.error("Activity error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
