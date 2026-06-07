import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (slug) {
      // Find single space by slug
      const result = await pool.query(
        `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order",
          (SELECT COUNT(*) FROM categories c WHERE c."spaceId" = ks.id) as "categoryCount",
          (SELECT COUNT(*) FROM articles a JOIN categories cat ON a."categoryId" = cat.id WHERE cat."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
         FROM knowledge_spaces ks
         WHERE ks.slug = $1 AND ks."isPublished" = true`,
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
        categoryCount: parseInt(space.categoryCount),
        articleCount: parseInt(space.articleCount),
      });
    }

    // List all published spaces with counts
    const result = await pool.query(
      `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order",
        (SELECT COUNT(*) FROM categories c WHERE c."spaceId" = ks.id) as "categoryCount",
        (SELECT COUNT(*) FROM articles a JOIN categories cat ON a."categoryId" = cat.id WHERE cat."spaceId" = ks.id AND a."isPublished" = true) as "articleCount"
       FROM knowledge_spaces ks
       WHERE ks."isPublished" = true
       ORDER BY ks."order" ASC`
    );

    const spaces = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon,
      order: row.order,
      categoryCount: parseInt(row.categoryCount as string),
      articleCount: parseInt(row.articleCount as string),
    }));

    return NextResponse.json(spaces);
  } catch (error) {
    console.error("Error fetching knowledge spaces:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки пространств" },
      { status: 500 }
    );
  }
}
