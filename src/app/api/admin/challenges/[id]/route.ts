import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { challengeUpdateSchema, buildSetClause, CHALLENGE_JSON_FIELDS } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const rawBody = await request.json();

    // Validate with Zod schema — rejects unknown keys and bad types
    const parseResult = challengeUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Ошибка валидации", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Build SET clause from validated data (column names are from schema, not user input)
    const { setClauses, values, nextParamIdx } = buildSetClause(data, CHALLENGE_JSON_FIELDS);

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE challenges SET ${setClauses.join(", ")} WHERE id = $${nextParamIdx} RETURNING *`;
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
    if (!session?.user || session.user.role !== "admin") {
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
