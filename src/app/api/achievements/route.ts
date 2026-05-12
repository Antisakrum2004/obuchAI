import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as Record<string, unknown>).id as string : null;

    const achievements = await db.achievement.findMany({
      orderBy: { category: "asc" },
      include: {
        userAchievements: userId
          ? { where: { userId } }
          : false,
      },
    });

    const result = achievements.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      slug: achievement.slug,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      xpReward: achievement.xpReward,
      earned: achievement.userAchievements?.length > 0,
      earnedAt: achievement.userAchievements?.[0]?.earnedAt || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Achievements error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
