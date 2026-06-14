import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? session.user.id
      : null;

    const achievementsResult = await query(
      `SELECT id, name, slug, description, icon, category, "xpReward" FROM achievements ORDER BY category ASC`,
    );

    // Get user's earned achievements if logged in
    const userAchievementsMap = new Map<string, Date>();
    if (userId) {
      const uaResult = await query(
        `SELECT "achievementId", "earnedAt" FROM user_achievements WHERE "userId" = $1`,
        [userId],
      );
      for (const row of uaResult.rows) {
        userAchievementsMap.set(row.achievementId, row.earnedAt);
      }
    }

    const result = achievementsResult.rows.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      slug: achievement.slug,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      xpReward: achievement.xpReward,
      earned: userAchievementsMap.has(achievement.id),
      earnedAt: userAchievementsMap.get(achievement.id) || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Achievements error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
