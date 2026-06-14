import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { categoryUpdateSchema, buildSetClause, CATEGORY_JSON_FIELDS } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/knowledge/categories/[id] — Get single category
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM articles a WHERE a."categoryId" = c.id) as "articleCount"
       FROM categories c
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Category get error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PUT /api/knowledge/categories/[id] — Update category (admin only)
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
    const parseResult = categoryUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Ошибка валидации", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Build SET clause from validated data
    const { setClauses, values, nextParamIdx } = buildSetClause(data, CATEGORY_JSON_FIELDS);

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE categories SET ${setClauses.join(", ")} WHERE id = $${nextParamIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Category update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/knowledge/categories/[id] — Delete category (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // First delete all articles' media, then articles, then category
    // Delete media for articles in this category
    await pool.query(
      `DELETE FROM media WHERE "articleId" IN (SELECT id FROM articles WHERE "categoryId" = $1)`,
      [id]
    );
    // Delete articles in this category
    await pool.query(
      `DELETE FROM articles WHERE "categoryId" = $1`,
      [id]
    );
    // Delete the category
    const result = await pool.query(
      `DELETE FROM categories WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Category delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
