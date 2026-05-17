import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    // Fixed 15 challenges for marathon mode
    const count = 15;

    // First try: select challenges the user hasn't solved yet
    const unsolvedResult = await query(
      `SELECT c.* FROM challenges c
       WHERE c."isActive" = true
       AND c.id NOT IN (
         SELECT ca."challengeId" FROM challenge_attempts ca
         WHERE ca."userId" = $1 AND ca."isCorrect" = true
       )
       ORDER BY
         CASE c.difficulty
           WHEN 'easy' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'hard' THEN 2
           ELSE 3
         END ASC,
         RANDOM()
       LIMIT $2`,
      [userId, count],
    );

    let challenges = unsolvedResult.rows;

    // If not enough unsolved, fill with all active challenges (including solved ones)
    if (challenges.length < count) {
      const alreadyIds = challenges.map((c: { id: string }) => c.id);

      if (alreadyIds.length > 0) {
        const placeholders = alreadyIds.map((_: unknown, i: number) => `$${i + 2}`).join(", ");
        const fillResult = await query(
          `SELECT c.* FROM challenges c
           WHERE c."isActive" = true
           AND c.id NOT IN (${placeholders})
           ORDER BY
             CASE c.difficulty
               WHEN 'easy' THEN 0
               WHEN 'medium' THEN 1
               WHEN 'hard' THEN 2
               ELSE 3
             END ASC,
             RANDOM()
           LIMIT $1`,
          [count - challenges.length, ...alreadyIds],
        );
        challenges = [...challenges, ...fillResult.rows];
      } else {
        // No unsolved found at all — pick from all
        const allResult = await query(
          `SELECT c.* FROM challenges c
           WHERE c."isActive" = true
           ORDER BY
             CASE c.difficulty
               WHEN 'easy' THEN 0
               WHEN 'medium' THEN 1
               WHEN 'hard' THEN 2
               ELSE 3
             END ASC,
             RANDOM()
           LIMIT $1`,
          [count],
        );
        challenges = allResult.rows;
      }
    }

    if (challenges.length === 0) {
      return NextResponse.json({ error: "Нет доступных задач" }, { status: 404 });
    }

    // Order by difficulty: easy first, then medium, then hard
    const diffOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    challenges.sort((a: { difficulty: string }, b: { difficulty: string }) => {
      return (diffOrder[a.difficulty] ?? 3) - (diffOrder[b.difficulty] ?? 3);
    });

    // Generate marathon ID
    const marathonId = genId();

    // Format challenges for the client — include correctAnswer for local marathon validation
    const formattedChallenges = challenges.map((c: Record<string, unknown>) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      type: c.type,
      category: c.category,
      xpReward: c.xpReward,
      content: c.content,
      options: c.options,
      correctAnswer: c.correctAnswer,
      explanation: c.explanation,
      hints: c.hints,
      validationType: c.validationType,
      validationConfig: c.validationConfig,
    }));

    return NextResponse.json({
      challenges: formattedChallenges,
      marathonId,
    });
  } catch (error) {
    console.error("Marathon GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
