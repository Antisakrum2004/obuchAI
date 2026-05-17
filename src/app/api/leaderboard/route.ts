import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "alltime";

    const usersResult = await query(
      `SELECT id, name, image, xp, streak, level, role FROM users ORDER BY xp DESC LIMIT 100`,
    );

    if (period === "alltime") {
      const leaderboard = usersResult.rows.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        name: user.name || "Аноним",
        image: user.image,
        xp: user.xp,
        streak: user.streak,
        level: user.level,
        role: user.role,
      }));
      return NextResponse.json(leaderboard);
    }

    // For weekly/monthly, filter by XP logs
    const since = new Date();
    if (period === "weekly") {
      since.setDate(since.getDate() - 7);
    } else if (period === "monthly") {
      since.setMonth(since.getMonth() - 1);
    }

    const xpLogsResult = await query(
      `SELECT "userId", SUM(amount) AS total FROM xp_logs WHERE "createdAt" >= $1 GROUP BY "userId"`,
      [since],
    );

    const xpByUser = new Map<string, number>();
    for (const row of xpLogsResult.rows) {
      xpByUser.set(row.userId, Number(row.total));
    }

    const filteredUsers = usersResult.rows
      .map((u) => ({
        ...u,
        periodXp: xpByUser.get(u.id) || 0,
      }))
      .filter((u) => u.periodXp > 0)
      .sort((a, b) => b.periodXp - a.periodXp)
      .map(({ periodXp, ...u }) => ({ ...u, xp: periodXp }));

    const leaderboard = filteredUsers.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name || "Аноним",
      image: user.image,
      xp: user.xp,
      streak: user.streak,
      level: user.level,
      role: user.role,
    }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
