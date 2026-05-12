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

    const userResult = await query(
      `SELECT id, name, email, image, role, xp, level, streak, "maxStreak", "lastActiveAt"
       FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Calculate rank
    const rankResult = await query(
      `SELECT COUNT(*) + 1 AS rank FROM users WHERE xp > $1`,
      [user.xp],
    );
    const rank = Number(rankResult.rows[0].rank);

    // Completed challenges count
    const completedResult = await query(
      `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true`,
      [userId],
    );
    const completedChallenges = Number(completedResult.rows[0].count);

    return NextResponse.json({
      ...user,
      rank,
      completedChallenges,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
