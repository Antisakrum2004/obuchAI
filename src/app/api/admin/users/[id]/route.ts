import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

/** Ensure the `banned` and `hearts` columns exist on the users table */
async function ensureColumns() {
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "hearts" INTEGER NOT NULL DEFAULT 3;`,
  ];
  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}

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

    // Ensure banned & hearts columns exist
    await ensureColumns();

    // Build SET clauses dynamically based on provided fields
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    // role — change role (admin/user)
    if (body.role !== undefined) {
      if (!["admin", "user"].includes(body.role)) {
        return NextResponse.json({ error: "Недопустимая роль" }, { status: 400 });
      }
      setClauses.push(`role = $${paramIdx++}`);
      values.push(body.role);
    }

    // banned — set boolean to ban/unban user
    if (body.banned !== undefined) {
      setClauses.push(`"banned" = $${paramIdx++}`);
      values.push(!!body.banned);
    }

    // xp — set absolute XP value
    if (body.xp !== undefined) {
      setClauses.push(`xp = $${paramIdx++}`);
      values.push(Number(body.xp));
    }

    // xpDelta — add/subtract XP (can be negative)
    if (body.xpDelta !== undefined) {
      setClauses.push(`xp = xp + $${paramIdx++}`);
      values.push(Number(body.xpDelta));
    }

    // hearts — set absolute hearts count
    if (body.hearts !== undefined) {
      setClauses.push(`hearts = $${paramIdx++}`);
      values.push(Number(body.hearts));
    }

    // heartsDelta — add/subtract hearts (can be negative)
    if (body.heartsDelta !== undefined) {
      setClauses.push(`hearts = GREATEST(hearts + $${paramIdx++}, 0)`);
      values.push(Number(body.heartsDelta));
    }

    // streak — set absolute streak
    if (body.streak !== undefined) {
      setClauses.push(`streak = $${paramIdx++}`);
      values.push(Number(body.streak));
    }

    // streakDelta — add/subtract streak (can be negative)
    if (body.streakDelta !== undefined) {
      setClauses.push(`streak = GREATEST(streak + $${paramIdx++}, 0)`);
      values.push(Number(body.streakDelta));
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING id, email, role, xp, level, streak, "hearts", "banned"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Admin user update error:", error);
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

    // Check the user exists
    const check = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Delete user — ON DELETE CASCADE will handle related records
    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

    return NextResponse.json({ success: true, message: `Пользователь ${check.rows[0].email} удалён` });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
