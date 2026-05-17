import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Fetch user basic info
    const userResult = await query(
      `SELECT id, name, image, xp, level, streak, "maxStreak", "createdAt", role
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Calculate rank (position by XP)
    const rankResult = await query(
      `SELECT COUNT(*) + 1 AS rank FROM users WHERE xp > $1`,
      [user.xp]
    );
    const rank = Number(rankResult.rows[0].rank);

    // Earned achievements
    const achievementsResult = await query(
      `SELECT a.id, a.name, a.slug, a.description, a.icon, a.category, a."xpReward", ua."earnedAt"
       FROM user_achievements ua
       JOIN achievements a ON a.id = ua."achievementId"
       WHERE ua."userId" = $1
       ORDER BY ua."earnedAt" DESC`,
      [userId]
    );

    // Skills with progress
    const skillsResult = await query(
      `SELECT us."skillId" AS id, s.name, s.slug, s.category, s.icon, s."requiredXp", us.xp, us.level AS skill_level
       FROM user_skills us
       JOIN skills s ON s.id = us."skillId"
       WHERE us."userId" = $1
       ORDER BY us.xp DESC`,
      [userId]
    );

    // Stats: completed challenges
    const completedResult = await query(
      `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true`,
      [userId]
    );
    const completedChallenges = Number(completedResult.rows[0].count);

    // Stats: total attempts
    const totalAttemptsResult = await query(
      `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1`,
      [userId]
    );
    const totalAttempts = Number(totalAttemptsResult.rows[0].count);

    // Stats: accuracy
    const accuracy =
      totalAttempts > 0
        ? Math.round((completedChallenges / totalAttempts) * 100)
        : 0;

    return NextResponse.json({
      id: user.id,
      name: user.name || "Аноним",
      image: user.image,
      xp: user.xp,
      level: user.level,
      streak: user.streak,
      maxStreak: user.maxStreak,
      createdAt: user.createdAt,
      role: user.role,
      rank,
      achievements: achievementsResult.rows.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        icon: a.icon,
        category: a.category,
        xpReward: a.xpReward,
        earnedAt: a.earnedAt,
      })),
      skills: skillsResult.rows.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        icon: s.icon,
        requiredXp: s.requiredXp,
        xp: s.xp,
        level: s.skill_level,
      })),
      stats: {
        completedChallenges,
        totalAttempts,
        accuracy,
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
