import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT c.*, 
        s.id AS "skill.id", s.name AS "skill.name", s.slug AS "skill.slug", 
        s.description AS "skill.description", s.icon AS "skill.icon", 
        s.category AS "skill.category", s."order" AS "skill.order", 
        s."parentId" AS "skill.parentId", s."requiredXp" AS "skill.requiredXp",
        s."createdAt" AS "skill.createdAt", s."updatedAt" AS "skill.updatedAt"
      FROM challenges c
      LEFT JOIN skills s ON s.id = c."skillId"
      WHERE c.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const row = result.rows[0];
    const challenge = {
      id: row.id,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      type: row.type,
      category: row.category,
      xpReward: row.xpReward,
      content: row.content,
      options: row.options,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
      hints: row.hints,
      validationType: row.validationType,
      validationConfig: row.validationConfig,
      skillId: row.skillId,
      order: row.order,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      skill: row["skill.id"]
        ? {
            id: row["skill.id"],
            name: row["skill.name"],
            slug: row["skill.slug"],
            description: row["skill.description"],
            icon: row["skill.icon"],
            category: row["skill.category"],
            order: row["skill.order"],
            parentId: row["skill.parentId"],
            requiredXp: row["skill.requiredXp"],
            createdAt: row["skill.createdAt"],
            updatedAt: row["skill.updatedAt"],
          }
        : null,
    };

    return NextResponse.json(challenge);
  } catch (error) {
    console.error("Challenge get error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Build UPDATE query dynamically from body
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      fields.push(`"${key}" = $${idx++}`);
      values.push(value);
    }

    values.push(id); // WHERE clause param

    const result = await query(
      `UPDATE challenges SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Challenge update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    await query(`DELETE FROM challenges WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Challenge delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
