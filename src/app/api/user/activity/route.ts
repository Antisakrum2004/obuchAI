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

    const userId = (session.user as Record<string, unknown>).id as string;
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Get XP per day for last 7 days
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
        activeDays.push(date.toISOString().split("T")[0]);
      }
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
    });
  } catch (error) {
    console.error("Activity error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
