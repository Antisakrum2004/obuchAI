import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { spaceUpdateSchema, buildSetClause } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/knowledge/spaces/[id] — Get single space with article count
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const spaceResult = await pool.query(
      `SELECT ks.*,
        (SELECT COUNT(*) FROM articles a WHERE a."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
      FROM knowledge_spaces ks
      WHERE ks.id = $1`,
      [id],
    );

    if (spaceResult.rows.length === 0) {
      return NextResponse.json({ error: "Раздел знаний не найден" }, { status: 404 });
    }

    return NextResponse.json(spaceResult.rows[0]);
  } catch (error) {
    console.error("Knowledge space get error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PUT /api/knowledge/spaces/[id] — Update space (admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const rawBody = await request.json();

    // Validate with Zod schema — rejects unknown keys and bad types
    const parseResult = spaceUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Ошибка валидации", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Build SET clause from validated data (no JSON fields in spaces)
    const { setClauses, values, nextParamIdx } = buildSetClause(data, new Set());

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE knowledge_spaces SET ${setClauses.join(", ")} WHERE id = $${nextParamIdx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Раздел знаний не найден" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Knowledge space update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/knowledge/spaces/[id] — Delete space (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Delete media first, then articles, then space
    await pool.query(`DELETE FROM media WHERE "articleId" IN (SELECT id FROM articles WHERE "spaceId" = $1)`, [id]);
    await pool.query(`DELETE FROM articles WHERE "spaceId" = $1`, [id]);

    const result = await pool.query(
      `DELETE FROM knowledge_spaces WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Раздел знаний не найден" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Knowledge space delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
