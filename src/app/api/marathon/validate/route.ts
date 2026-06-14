import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Rate limit: 20 validations per minute per user
    const rateResult = checkRateLimit(`marathon:${session.user.id}`, RATE_LIMITS.marathon);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток. Подождите немного." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { challengeId, answer } = body;

    if (!challengeId || answer === undefined || answer === null) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    // Fetch the challenge from DB to get the correct answer
    const result = await query(
      `SELECT "correctAnswer", "validationType", "validationConfig", type, explanation FROM challenges WHERE id = $1`,
      [challengeId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const challenge = result.rows[0];

    // Validate answer using the same logic as the challenges submit endpoint
    let isCorrect = false;

    if (challenge.validationType === "static") {
      try {
        const correctAnswer = JSON.parse(challenge.correctAnswer);
        if (challenge.type === "multiple_choice") {
          isCorrect = String(answer) === String(correctAnswer);
        } else if (challenge.type === "ordering" || challenge.type === "workflow_build") {
          const userAnswer = Array.isArray(answer) ? answer : JSON.parse(typeof answer === "string" ? answer : "[]");
          isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
        }
      } catch {
        isCorrect = false;
      }
    } else if (challenge.validationType === "pattern") {
      try {
        const config = challenge.validationConfig ? JSON.parse(challenge.validationConfig) : {};
        const keywords: string[] = config.keywords || [];
        if (keywords.length > 0) {
          const answerStr = String(answer).toLowerCase();
          isCorrect = keywords.every((kw: string) => answerStr.includes(kw.toLowerCase()));
        }
      } catch {
        isCorrect = false;
      }
    }

    return NextResponse.json({ isCorrect });
  } catch (error) {
    console.error("Marathon validate error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
