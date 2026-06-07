import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/knowledge/spaces/[id] — Get single space with categories and article counts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const spaceResult = await pool.query(
      `SELECT ks.*, 
        (SELECT COUNT(*) FROM categories WHERE "spaceId" = ks.id) as "categoryCount",
        (SELECT COUNT(*) FROM articles a JOIN categories c ON a."categoryId" = c.id WHERE c."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
      FROM knowledge_spaces ks
      WHERE ks.id = $1`,
      [id],
    );

    if (spaceResult.rows.length === 0) {
      return NextResponse.json({ error: "Пространство знаний не найдено" }, { status: 404 });
    }

    const categoriesResult = await pool.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM articles a WHERE a."categoryId" = c.id AND a."isPublished" = true) as "articleCount"
      FROM categories c
      WHERE c."spaceId" = $1
      ORDER BY c."order"`,
      [id],
    );

    return NextResponse.json({
      ...spaceResult.rows[0],
      categories: categoriesResult.rows,
    });
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
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      fields.push(`"${key}" = $${idx++}`);
      values.push(value);
    }

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE knowledge_spaces SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Пространство знаний не найдено" }, { status: 404 });
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
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    const result = await pool.query(
      `DELETE FROM knowledge_spaces WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Пространство знаний не найдено" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Knowledge space delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
