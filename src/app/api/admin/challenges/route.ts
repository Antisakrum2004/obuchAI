import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { validateChallengeBody } from "@/lib/validate";

function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();

    const validation = validateChallengeBody(body);
    if (!validation.valid) {
      return NextResponse.json({ error: "Ошибка валидации", details: validation.errors }, { status: 400 });
    }

    const {
      title, description, difficulty, type, category,
      xpReward, content, options, correctAnswer, explanation,
      hints, validationType, validationConfig, skillId, order, isActive,
    } = body;

    if (!title || !description || !difficulty || !type || !category || !content || !correctAnswer) {
      return NextResponse.json(
        { error: "Обязательные поля: title, description, difficulty, type, category, content, correctAnswer" },
        { status: 400 }
      );
    }

    const id = genId();
    const result = await pool.query(
      `INSERT INTO challenges (id, title, description, difficulty, type, category, "xpReward", content, options, "correctAnswer", explanation, hints, "validationType", "validationConfig", "skillId", "order", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
       RETURNING *`,
      [
        id,
        title,
        description,
        difficulty,
        type,
        category,
        xpReward || 25,
        content,
        options || null,
        correctAnswer,
        explanation || null,
        hints || null,
        validationType || "static",
        validationConfig || null,
        skillId || null,
        order || 0,
        isActive !== undefined ? isActive : true,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Admin challenge create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера", detail: String(error) },
      { status: 500 }
    );
  }
}
