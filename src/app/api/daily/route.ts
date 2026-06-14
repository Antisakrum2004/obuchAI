import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { isStreakBroken } from "@/lib/gamification";

// Generate a CUID-like ID
function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check streak
    const userResult = await query(
      `SELECT "lastActiveAt", streak FROM users WHERE id = $1`,
      [userId],
    );
    const user = userResult.rows[0];
    if (user && isStreakBroken(user.lastActiveAt) && user.streak > 0) {
      await query(`UPDATE users SET streak = 0 WHERE id = $1`, [userId]);
    }

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if daily assignment exists
    const assignmentResult = await query(
      `SELECT dca.id, dca."challengeId", dca.completed, dca."completedAt",
        c.id AS "challenge.id", c.title AS "challenge.title", c.description AS "challenge.description",
        c.difficulty AS "challenge.difficulty", c.type AS "challenge.type",
        c.category AS "challenge.category", c."xpReward" AS "challenge.xpReward"
      FROM daily_challenge_assignments dca
      JOIN challenges c ON c.id = dca."challengeId"
      WHERE dca."userId" = $1 AND dca.date >= $2 AND dca.date < $3`,
      [userId, today, tomorrow],
    );

    if (assignmentResult.rows.length > 0) {
      const row = assignmentResult.rows[0];
      return NextResponse.json({
        assignmentId: row.id,
        challengeId: row.challengeId,
        completed: row.completed,
        completedAt: row.completedAt,
        challenge: {
          id: row["challenge.id"],
          title: row["challenge.title"],
          description: row["challenge.description"],
          difficulty: row["challenge.difficulty"],
          type: row["challenge.type"],
          category: row["challenge.category"],
          xpReward: row["challenge.xpReward"],
        },
      });
    }

    // No assignment for today — create one
    // Get completed challenge IDs for today
    const completedResult = await query(
      `SELECT "challengeId" FROM challenge_attempts
       WHERE "userId" = $1 AND "isCorrect" = true AND "createdAt" >= $2 AND "createdAt" < $3`,
      [userId, today, tomorrow],
    );
    const completedIds = completedResult.rows.map((r) => r.challengeId);

    // Get available challenges (active, not completed today)
    let availableResult;
    if (completedIds.length > 0) {
      const placeholders = completedIds.map((_, i) => `$${i + 1}`).join(", ");
      availableResult = await query(
        `SELECT id FROM challenges WHERE "isActive" = true AND id NOT IN (${placeholders})`,
        completedIds,
      );
    } else {
      availableResult = await query(
        `SELECT id FROM challenges WHERE "isActive" = true`,
      );
    }

    if (availableResult.rows.length === 0) {
      return NextResponse.json({
        assignmentId: null,
        challengeId: null,
        completed: false,
        completedAt: null,
        challenge: null,
      });
    }

    const randomIndex = Math.floor(Math.random() * availableResult.rows.length);
    const randomChallengeId = availableResult.rows[randomIndex].id;

    // Create assignment
    const assignmentId = genId();
    await query(
      `INSERT INTO daily_challenge_assignments (id, "userId", "challengeId", date, completed)
       VALUES ($1, $2, $3, $4, false)`,
      [assignmentId, userId, randomChallengeId, today],
    );

    // Get the challenge details
    const challengeResult = await query(
      `SELECT id, title, description, difficulty, type, category, "xpReward" FROM challenges WHERE id = $1`,
      [randomChallengeId],
    );
    const challenge = challengeResult.rows[0];

    return NextResponse.json({
      assignmentId,
      challengeId: randomChallengeId,
      completed: false,
      completedAt: null,
      challenge,
    });
  } catch (error) {
    console.error("Daily challenge error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
