import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const where: Record<string, unknown> = { isPublished: true };

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (spaceId) {
      where.category = { spaceId };
    }

    const articles = await db.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        tags: true,
        viewCount: true,
        categoryId: true,
        createdAt: true,
      },
    });

    const result = articles.map((article) => ({
      ...article,
      createdAt: article.createdAt.toISOString(),
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
