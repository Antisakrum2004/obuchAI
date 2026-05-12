import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "alltime";

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        xp: true,
        streak: true,
        level: true,
      },
      orderBy: { xp: "desc" },
      take: 100,
    });

    // For weekly/monthly, filter by XP logs
    let filteredUsers = users;
    if (period !== "alltime") {
      const since = new Date();
      if (period === "weekly") {
        since.setDate(since.getDate() - 7);
      } else if (period === "monthly") {
        since.setMonth(since.getMonth() - 1);
      }

      const xpLogs = await db.xPLog.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true, amount: true },
      });

      const xpByUser = new Map<string, number>();
      for (const log of xpLogs) {
        xpByUser.set(log.userId, (xpByUser.get(log.userId) || 0) + log.amount);
      }

      filteredUsers = users
        .map((u) => ({
          ...u,
          periodXp: xpByUser.get(u.id) || 0,
        }))
        .filter((u) => u.periodXp > 0)
        .sort((a, b) => b.periodXp - a.periodXp)
        .map(({ periodXp, ...u }) => ({ ...u, xp: periodXp }));
    }

    const leaderboard = filteredUsers.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name || "Аноним",
      image: user.image,
      xp: user.xp,
      streak: user.streak,
      level: user.level,
    }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
