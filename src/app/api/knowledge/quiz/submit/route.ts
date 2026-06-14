import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { xpForQuiz, calculateLevel, getGradeName } from "@/lib/gamification";
import { genId } from "@/lib/gen-id";
import { ensureColumn } from "@/lib/db-migrate";

// Ensure Sprint 7 columns exist (delegates to centralized db-migrate)
let sprint7Ensured = false;
async function ensureSprint7Columns() {
  if (sprint7Ensured) return;
  await ensureColumn("articles", "quiz", "JSONB");
  await ensureColumn("articles", "practical_task", "JSONB");
  await ensureColumn("articles", "timecodes", "JSONB");
  sprint7Ensured = true;
}

export const dynamic = "force-dynamic";

interface QuizSubmitBody {
  articleId: string;
  correctCount: number;
  totalCount: number;
  difficulty: string;
  timeSpent: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body: QuizSubmitBody = await request.json();
    const { articleId, correctCount, totalCount, difficulty, timeSpent } = body;

    if (!articleId || typeof correctCount !== "number" || typeof totalCount !== "number" || !difficulty) {
      return NextResponse.json(
        { error: "Неверные параметры запроса" },
        { status: 400 }
      );
    }

    if (correctCount < 0 || totalCount <= 0 || correctCount > totalCount) {
      return NextResponse.json(
        { error: "Некорректное количество правильных ответов" },
        { status: 400 }
      );
    }

    // 3. Validate that the article exists and has a quiz
    let articleResult;
    try {
      articleResult = await pool.query(
        `SELECT id, quiz FROM articles WHERE id = $1`,
        [articleId]
      );
    } catch (error: any) {
      if (error?.code === '42703' || (error?.message && error.message.includes('does not exist'))) {
        console.log('[QuizSubmit] Sprint 7 columns missing — auto-migrating...');
        await ensureSprint7Columns();
        return NextResponse.json(
          { error: 'Схема обновлена, попробуйте ещё раз', retry: true },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!articleResult.rows[0]) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    const article = articleResult.rows[0];
    if (!article.quiz) {
      return NextResponse.json(
        { error: "У этой статьи нет квиза" },
        { status: 400 }
      );
    }

    // 4. Calculate XP using the xpForQuiz function
    const xpEarned = xpForQuiz(correctCount, totalCount, difficulty);

    // 5. Get current user XP and update
    const userResult = await pool.query(
      `SELECT xp FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows[0]) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const currentXp = userResult.rows[0].xp ?? 0;
    const newTotalXp = currentXp + xpEarned;
    const newLevel = calculateLevel(newTotalXp);

    // Update user's XP and level
    await pool.query(
      `UPDATE users SET xp = xp + $1, level = $2, "lastActiveAt" = NOW() WHERE id = $3`,
      [xpEarned, newLevel, userId]
    );

    // 6. Log the XP gain in xp_logs table
    const logId = genId("xpl_");
    await pool.query(
      `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId", "createdAt") VALUES ($1, $2, $3, 'quiz', $4, NOW())`,
      [logId, userId, xpEarned, articleId]
    );

    // 7. Return success response
    const grade = getGradeName(newLevel);
    return NextResponse.json({
      success: true,
      xpEarned,
      totalXp: newTotalXp,
      newLevel,
      grade,
    });
  } catch (error) {
    console.error("[Quiz Submit] Error:", error);
    return NextResponse.json(
      { error: "Ошибка при обработке результатов квиза" },
      { status: 500 }
    );
  }
}
