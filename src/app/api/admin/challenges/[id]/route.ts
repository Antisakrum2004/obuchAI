import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Build SET clause dynamically from allowed fields
    const allowedFields = [
      "title", "description", "difficulty", "type", "category",
      "xpReward", "content", "options", "correctAnswer", "explanation",
      "hints", "validationType", "isActive",
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`"${field}" = $${paramIdx}`);
        // JSON fields need to be stringified
        if (["content", "options", "correctAnswer", "hints"].includes(field)) {
          values.push(typeof body[field] === "string" ? body[field] : JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE challenges SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Admin challenge update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Delete attempts first (foreign key)
    await pool.query(`DELETE FROM challenge_attempts WHERE "challengeId" = $1`, [id]);
    const result = await pool.query(`DELETE FROM challenges WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin challenge delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
