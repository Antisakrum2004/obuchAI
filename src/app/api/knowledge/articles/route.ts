import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const categoryId = searchParams.get("categoryId");

    if (!spaceId && !categoryId) {
      return NextResponse.json(
        { error: "Не указан spaceId или categoryId" },
        { status: 400 }
      );
    }

    let query: string;
    let params: unknown[];

    if (categoryId) {
      query = `SELECT id, title, slug, summary, tags, "viewCount", "categoryId", "createdAt"
               FROM articles
               WHERE "isPublished" = true AND "categoryId" = $1
               ORDER BY "createdAt" DESC`;
      params = [categoryId];
    } else {
      query = `SELECT a.id, a.title, a.slug, a.summary, a.tags, a."viewCount", a."categoryId", a."createdAt"
               FROM articles a
               JOIN categories c ON a."categoryId" = c.id
               WHERE a."isPublished" = true AND c."spaceId" = $1
               ORDER BY a."createdAt" DESC`;
      params = [spaceId];
    }

    const { rows } = await pool.query(query, params);

    const result = rows.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      tags: article.tags,
      viewCount: article.viewCount,
      categoryId: article.categoryId,
      createdAt: new Date(article.createdAt).toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки статей" },
      { status: 500 }
    );
  }
}
