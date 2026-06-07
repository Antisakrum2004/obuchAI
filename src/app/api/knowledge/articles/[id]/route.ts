import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const article = await db.article.findUnique({
      where: { id, isPublished: true },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            space: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    // Increment view count (non-blocking)
    db.article
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // Find related glossary terms (by matching tags or key topics)
    const tags = article.tags ? JSON.parse(article.tags) : [];
    const keyTopics = article.keyTopics ? JSON.parse(article.keyTopics) : [];

    const searchTerms = [...tags, ...keyTopics].filter(Boolean).slice(0, 5);

    let relatedGlossary: Array<{
      id: string;
      term: string;
      shortDefinition: string | null;
      category: string | null;
    }> = [];

    if (searchTerms.length > 0) {
      // Try to find glossary terms that match tags/topics
      relatedGlossary = await db.glossaryTerm.findMany({
        where: {
          OR: searchTerms.map((term: string) => ({
            term: { contains: term, mode: "insensitive" },
          })),
        },
        take: 8,
        select: {
          id: true,
          term: true,
          shortDefinition: true,
          category: true,
        },
      });

      // If no matches by tag, return some general glossary terms
      if (relatedGlossary.length === 0) {
        relatedGlossary = await db.glossaryTerm.findMany({
          take: 5,
          orderBy: { order: "asc" },
          select: {
            id: true,
            term: true,
            shortDefinition: true,
            category: true,
          },
        });
      }
    }

    const result = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.summary,
      tags: article.tags,
      keyTopics: article.keyTopics,
      viewCount: article.viewCount,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      category: article.category,
      relatedGlossary,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки статьи" },
      { status: 500 }
    );
  }
}
