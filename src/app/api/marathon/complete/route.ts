import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { xpForDifficulty, calculateLevel } from "@/lib/gamification";

function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// Calculate streak-based multiplier
function marathonMultiplier(streak: number): number {
  if (streak >= 15) return 3.0;
  if (streak >= 10) return 2.0;
  if (streak >= 5) return 1.5;
  return 1.0;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { correctCount, totalAttempts, longestStreak } = body;

    // Validate input
    if (
      typeof correctCount !== "number" ||
      typeof totalAttempts !== "number" ||
      typeof longestStreak !== "number"
    ) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    // Calculate multiplier based on longest streak
    const multiplier = marathonMultiplier(longestStreak);

    // Calculate base XP from correct answers (sum of difficulty-based XP)
    // Since we don't know the specific challenges, use average: ~40 XP per correct answer
    const baseXpPerCorrect = 40;
    const baseXp = correctCount * baseXpPerCorrect;

    // Apply multiplier
    const xpEarned = Math.round(baseXp * multiplier);

    // Calculate accuracy
    const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

    // Update user XP
    const userResult = await query(
      `SELECT xp, level FROM users WHERE id = $1`,
      [userId],
    );

    let newLevel = 1;
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const newXp = (user.xp || 0) + xpEarned;
      newLevel = calculateLevel(newXp);

      await query(
        `UPDATE users SET xp = $1, level = $2, "lastActiveAt" = $3 WHERE id = $4`,
        [newXp, newLevel, new Date(), userId],
      );
    }

    // Log XP
    if (xpEarned > 0) {
      const xpLogId = genId();
      await query(
        `INSERT INTO xp_logs (id, "userId", amount, reason) VALUES ($1, $2, $3, $4)`,
        [xpLogId, userId, xpEarned, "marathon"],
      );
    }

    return NextResponse.json({
      xpEarned,
      multiplier,
      accuracy,
      newLevel,
    });
  } catch (error) {
    console.error("Marathon complete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
