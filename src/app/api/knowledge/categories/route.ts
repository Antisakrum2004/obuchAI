import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const all = searchParams.get("all"); // admin: include empty categories

    if (!spaceId) {
      return NextResponse.json(
        { error: "Не указан spaceId" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.icon, c."order", c."parentId", c."spaceId",
              COUNT(a.id)::int AS "articleCount"
       FROM categories c
       LEFT JOIN articles a ON a."categoryId" = c.id ${all !== "true" ? 'AND a."isPublished" = true' : ""}
       WHERE c."spaceId" = $1 AND c."parentId" IS NULL
       GROUP BY c.id
       ORDER BY c."order" ASC`,
      [spaceId]
    );

    const result = rows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      order: cat.order,
      parentId: cat.parentId,
      spaceId: cat.spaceId,
      articleCount: cat.articleCount,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки категорий" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge/categories — Create category (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, icon, order, spaceId, parentId } = body;

    if (!name || !slug || !spaceId) {
      return NextResponse.json(
        { error: "name, slug и spaceId обязательны" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await pool.query(
      `SELECT id FROM categories WHERE slug = $1`,
      [slug]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Категория с таким slug уже существует" },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, icon, "order", "spaceId", "parentId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        name,
        slug,
        description || null,
        icon || null,
        order || 0,
        spaceId,
        parentId || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Ошибка создания категории" },
      { status: 500 }
    );
  }
}
