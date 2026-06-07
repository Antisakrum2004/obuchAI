import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (slug) {
      // Find single space by slug
      const space = await db.knowledgeSpace.findUnique({
        where: { slug, isPublished: true },
        include: {
          categories: {
            where: { parentId: null },
            orderBy: { order: "asc" },
            include: {
              _count: { select: { articles: { where: { isPublished: true } } } },
            },
          },
          _count: {
            select: {
              categories: true,
              articles: true,
            },
          },
        },
      });

      if (!space) {
        return NextResponse.json(
          { error: "Пространство не найдено" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        icon: space.icon,
        categoryCount: space._count.categories,
        articleCount: space._count.articles,
      });
    }

    // List all published spaces with counts
    const spaces = await db.knowledgeSpace.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            categories: true,
            articles: { where: { isPublished: true } },
          },
        },
      },
    });

    const result = spaces.map((space) => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      icon: space.icon,
      order: space.order,
      categoryCount: space._count.categories,
      articleCount: space._count.articles,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching knowledge spaces:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки пространств" },
      { status: 500 }
    );
  }
}
