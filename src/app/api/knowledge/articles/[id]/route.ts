import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all"); // admin: include unpublished

    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.content, a.summary, a.tags,
              a."keyTopics", a."viewCount", a."isPublished", a."createdAt", a."updatedAt",
              a."videoUrl", a."pdfUrl", a."pptxUrl", a."sourceUrl", a."sourceType",
              a.difficulty, a."estimatedTime", a.status, a."aiGenerated",
              a."processedAt", a."errorMessage", a."keyConcepts",
              a.prerequisites, a."nextTopics",
              a.quiz, a.practical_task, a.timecodes,
              json_build_object(
                'id', ks.id,
                'name', ks.name,
                'slug', ks.slug
              ) AS space
       FROM articles a
       JOIN knowledge_spaces ks ON a."spaceId" = ks.id
       WHERE a.id = $1 ${all !== "true" ? 'AND a."isPublished" = true' : ""}`,
      [id]
    );

    const article = rows[0];

    if (!article) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    // Increment view count (non-blocking, fire and forget) — only for published
    if (article.isPublished) {
      pool
        .query(`UPDATE articles SET "viewCount" = "viewCount" + 1 WHERE id = $1`, [id])
        .catch(() => {});
    }

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

      relatedGlossary = glossaryRows.map((g: any) => ({
        id: g.id as string,
        term: g.term as string,
        shortDefinition: g.shortDefinition as string | null,
        category: g.category as string | null,
      }));

      // If no matches by tag, return some general glossary terms
      if (relatedGlossary.length === 0) {
        const { rows: fallbackRows } = await pool.query(
          `SELECT id, term, "shortDefinition", category
           FROM glossary_terms
           ORDER BY order ASC
           LIMIT 5`
        );

        relatedGlossary = fallbackRows.map((g: any) => ({
          id: g.id as string,
          term: g.term as string,
          shortDefinition: g.shortDefinition as string | null,
          category: g.category as string | null,
        }));
      }
    }

    // Check if there's a PDF in the media table (for articles where pdfUrl is empty but PDF was uploaded)
    let hasMediaPdf = false;
    if (!article.pdfUrl) {
      const { rows: mediaCheck } = await pool.query(
        `SELECT id FROM media WHERE "articleId" = $1 AND "mimeType" LIKE 'application/pdf%' LIMIT 1`,
        [id]
      );
      hasMediaPdf = mediaCheck.length > 0;
    }

    const result = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.summary,
      tags: article.tags,
      keyTopics: article.keyTopics,
      isPublished: article.isPublished,
      viewCount: article.viewCount,
      createdAt: new Date(article.createdAt).toISOString(),
      updatedAt: new Date(article.updatedAt).toISOString(),
      space: article.space,
      relatedGlossary,
      // Sprint 6: new fields
      videoUrl: article.videoUrl,
      pdfUrl: article.pdfUrl,
      pptxUrl: article.pptxUrl,
      sourceUrl: article.sourceUrl,
      sourceType: article.sourceType,
      difficulty: article.difficulty,
      estimatedTime: article.estimatedTime,
      status: article.status,
      aiGenerated: article.aiGenerated,
      processedAt: article.processedAt ? new Date(article.processedAt).toISOString() : null,
      errorMessage: article.errorMessage,
      keyConcepts: article.keyConcepts,
      prerequisites: article.prerequisites,
      nextTopics: article.nextTopics,
      // Sprint 7: Interactive lesson fields
      quiz: article.quiz,
      practical_task: article.practical_task,
      timecodes: article.timecodes,
      hasMediaPdf,
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

// PUT /api/knowledge/articles/[id] — Update article (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      "title", "slug", "content", "summary", "spaceId", "isPublished",
      // Sprint 6: new fields
      "videoUrl", "pdfUrl", "pptxUrl", "sourceUrl", "sourceType",
      "difficulty", "estimatedTime", "status", "aiGenerated",
      "errorMessage",
    ];
    const jsonFields = ["tags", "keyTopics", "keyConcepts", "prerequisites", "nextTopics",
      // Sprint 7: JSONB fields for interactive lessons
      "quiz", "practical_task", "timecodes",
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (jsonFields.includes(key)) {
        fields.push(`"${key}" = $${idx++}`);
        values.push(value ? JSON.stringify(value) : null);
      } else if (allowedFields.includes(key)) {
        fields.push(`"${key}" = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE articles SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Ошибка обновления статьи" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/articles/[id] — Delete article (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Delete media first
    await pool.query(`DELETE FROM media WHERE "articleId" = $1`, [id]);

    const result = await pool.query(
      `DELETE FROM articles WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Ошибка удаления статьи" },
      { status: 500 }
    );
  }
}
