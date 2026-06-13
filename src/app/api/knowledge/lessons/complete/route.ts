import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { calculateLevel, getGradeName, xpProgressInLevel, totalXpForLevel, xpForLevel } from "@/lib/gamification";
import { genId } from "@/lib/gen-id";

export const dynamic = "force-dynamic";

interface LessonCompleteBody {
  articleId: string;
  /** How many blocks the user completed (summary, quiz, practice, etc.) */
  blocksCompleted?: number;
  /** Total blocks available */
  totalBlocks?: number;
  /** Time spent on lesson in seconds */
  timeSpent?: number;
}

/**
 * Award XP for completing a lesson.
 *
 * XP formula:
 *   - Base: 30 XP for completing any lesson
 *   - Bonus for completing all blocks: +20 XP
 *   - Bonus per extra block (beyond summary): +10 XP each
 *   So a lesson with 4 blocks all completed = 30 + 20 + 30 = 80 XP
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    if (!userId) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body: LessonCompleteBody = await request.json();
    const { articleId, blocksCompleted = 0, totalBlocks = 0, timeSpent = 0 } = body;

    if (!articleId) {
      return NextResponse.json({ error: "Не указана статья" }, { status: 400 });
    }

    // Validate article exists
    const articleResult = await pool.query(
      `SELECT id, title, difficulty FROM articles WHERE id = $1`,
      [articleId]
    );
    if (!articleResult.rows[0]) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    // Calculate XP for lesson completion
    const baseXp = 30;
    const allBlocksBonus = blocksCompleted >= totalBlocks && totalBlocks > 0 ? 20 : 0;
    const extraBlocks = Math.max(0, blocksCompleted - 1); // first block (summary) doesn't count as extra
    const extraBlocksXp = extraBlocks * 10;
    const xpEarned = baseXp + allBlocksBonus + extraBlocksXp;

    // Get current user XP
    const userResult = await pool.query(
      `SELECT xp, level FROM users WHERE id = $1`,
      [userId]
    );
    if (!userResult.rows[0]) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const currentXp = userResult.rows[0].xp ?? 0;
    const newTotalXp = currentXp + xpEarned;
    const newLevel = calculateLevel(newTotalXp);

    // Update user XP and level
    await pool.query(
      `UPDATE users SET xp = xp + $1, level = $2, "lastActiveAt" = NOW() WHERE id = $3`,
      [xpEarned, newLevel, userId]
    );

    // Log XP gain
    const logId = genId("xpl_");
    await pool.query(
      `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId", "createdAt") VALUES ($1, $2, $3, 'lesson_complete', $4, NOW())`,
      [logId, userId, xpEarned, articleId]
    );

    // Calculate progress to next level (for motivation display)
    const progress = xpProgressInLevel(newTotalXp);
    const xpToNextLevel = progress.required - progress.current;

    // Find next lesson in the same space
    const article = articleResult.rows[0];
    let nextLesson: { id: string; title: string } | null = null;

    try {
      // Get articles in the same space, ordered by the learning path
      const nextResult = await pool.query(
        `SELECT a.id, a.title
         FROM articles a
         WHERE a."spaceId" = (SELECT "spaceId" FROM articles WHERE id = $1)
           AND a.id != $1
           AND a.status = 'published'
         ORDER BY a."order" ASC, a."createdAt" ASC
         LIMIT 1`,
        [articleId]
      );
      if (nextResult.rows[0]) {
        nextLesson = { id: nextResult.rows[0].id, title: nextResult.rows[0].title };
      }
    } catch {
      // Non-critical — skip next lesson lookup
    }

    const grade = getGradeName(newLevel);

    return NextResponse.json({
      success: true,
      xpEarned,
      totalXp: newTotalXp,
      newLevel,
      grade,
      xpToNextLevel,
      progressInLevel: progress,
      nextLesson,
      articleTitle: article.title,
    });
  } catch (error) {
    console.error("[Lesson Complete] Error:", error);
    return NextResponse.json(
      { error: "Ошибка при завершении урока" },
      { status: 500 }
    );
  }
}
