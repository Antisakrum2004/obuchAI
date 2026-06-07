import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const all = searchParams.get("all"); // admin: include unpublished

    if (slug) {
      // Find single space by slug
      const result = await pool.query(
        `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order", ks."isPublished",
          (SELECT COUNT(*) FROM categories c WHERE c."spaceId" = ks.id) as "categoryCount",
          (SELECT COUNT(*) FROM articles a JOIN categories cat ON a."categoryId" = cat.id WHERE cat."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
         FROM knowledge_spaces ks
         WHERE ks.slug = $1 ${all !== "true" ? 'AND ks."isPublished" = true' : ""}`,
        [slug]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Пространство не найдено" },
          { status: 404 }
        );
      }

      const space = result.rows[0];
      return NextResponse.json({
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        icon: space.icon,
        order: space.order,
        isPublished: space.isPublished,
        categoryCount: parseInt(space.categoryCount),
        articleCount: parseInt(space.articleCount),
      });
    }

    // List all spaces with counts
    const result = await pool.query(
      `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order", ks."isPublished",
        (SELECT COUNT(*) FROM categories c WHERE c."spaceId" = ks.id) as "categoryCount",
        (SELECT COUNT(*) FROM articles a JOIN categories cat ON a."categoryId" = cat.id WHERE cat."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
       FROM knowledge_spaces ks
       ${all !== "true" ? 'WHERE ks."isPublished" = true' : ""}
       ORDER BY ks."order" ASC`
    );

    const spaces = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon,
      order: row.order,
      isPublished: row.isPublished,
      categoryCount: parseInt(row.categoryCount as string),
      articleCount: parseInt(row.articleCount as string),
    }));

    return NextResponse.json(spaces);
  } catch (error) {
    console.error("Error fetching knowledge spaces:", error);
    // If table doesn't exist yet, return empty array instead of 500
    return NextResponse.json([]);
  }
}

// POST /api/knowledge/spaces — Create space (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, icon, order, isPublished } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name и slug обязательны" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await pool.query(
      `SELECT id FROM knowledge_spaces WHERE slug = $1`,
      [slug]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Пространство с таким slug уже существует" },
        { status: 409 }
      );
    }

    const id = 'ks_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    const result = await pool.query(
      `INSERT INTO knowledge_spaces (id, name, slug, description, icon, "order", "isPublished", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        id,
        name,
        slug,
        description || null,
        icon || null,
        order || 0,
        isPublished !== undefined ? isPublished : true,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating knowledge space:", error);
    return NextResponse.json(
      { error: "Ошибка создания пространства" },
      { status: 500 }
    );
  }
}
