import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        xp: true,
        level: true,
        streak: true,
        maxStreak: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Calculate rank
    const usersWithHigherXp = await db.user.count({
      where: { xp: { gt: user.xp } },
    });
    const rank = usersWithHigherXp + 1;

    // Completed challenges count
    const completedChallenges = await db.challengeAttempt.count({
      where: { userId, isCorrect: true },
    });

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
