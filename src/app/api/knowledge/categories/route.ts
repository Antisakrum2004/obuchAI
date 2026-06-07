import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");

    if (!spaceId) {
      return NextResponse.json(
        { error: "Не указан spaceId" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.icon, c.order,
              COUNT(a.id)::int AS "articleCount"
       FROM categories c
       LEFT JOIN articles a ON a."categoryId" = c.id AND a."isPublished" = true
       WHERE c."spaceId" = $1 AND c."parentId" IS NULL
       GROUP BY c.id
       ORDER BY c.order ASC`,
      [spaceId]
    );

    const result = rows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      order: cat.order,
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
