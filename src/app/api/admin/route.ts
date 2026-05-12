import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/stats - Overview stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const [totalUsers, totalChallenges, totalAttempts, totalXpLogs] = await Promise.all([
      db.user.count(),
      db.challenge.count(),
      db.challengeAttempt.count(),
      db.xPLog.count(),
    ]);

    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, xp: true, level: true, createdAt: true },
    });

    const todayAttempts = await db.challengeAttempt.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

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
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
