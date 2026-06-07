import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.content, a.summary, a.tags,
              a."keyTopics", a."viewCount", a."createdAt", a."updatedAt",
              json_build_object(
                'id', c.id,
                'name', c.name,
                'slug', c.slug,
                'space', json_build_object(
                  'id', s.id,
                  'name', s.name,
                  'slug', s.slug
                )
              ) AS category
       FROM articles a
       JOIN categories c ON a."categoryId" = c.id
       JOIN spaces s ON c."spaceId" = s.id
       WHERE a.id = $1 AND a."isPublished" = true`,
      [id]
    );

    const article = rows[0];

    if (!article) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    // Increment view count (non-blocking, fire and forget)
    pool
      .query(`UPDATE articles SET "viewCount" = "viewCount" + 1 WHERE id = $1`, [id])
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
      // Build ILIKE conditions for each search term
      const conditions = searchTerms
        .map((_: string, i: number) => `term ILIKE $${i + 1}`)
        .join(" OR ");
      const likeParams = searchTerms.map((term: string) => `%${term}%`);

      const { rows: glossaryRows } = await pool.query(
        `SELECT id, term, "shortDefinition", category
         FROM glossary_terms
         WHERE ${conditions}
         LIMIT 8`,
        likeParams
      );

      relatedGlossary = glossaryRows.map((g) => ({
        id: g.id,
        term: g.term,
        shortDefinition: g.shortDefinition,
        category: g.category,
      }));

      // If no matches by tag, return some general glossary terms
      if (relatedGlossary.length === 0) {
        const { rows: fallbackRows } = await pool.query(
          `SELECT id, term, "shortDefinition", category
           FROM glossary_terms
           ORDER BY order ASC
           LIMIT 5`
        );

        relatedGlossary = fallbackRows.map((g) => ({
          id: g.id,
          term: g.term,
          shortDefinition: g.shortDefinition,
          category: g.category,
        }));
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
      createdAt: new Date(article.createdAt).toISOString(),
      updatedAt: new Date(article.updatedAt).toISOString(),
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
