import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/knowledge/search?q=searchterm — Global search across articles, glossary terms, and challenges
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ articles: [], glossary: [], challenges: [] });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search articles by title, summary, tags (ILIKE) — now using spaceId instead of categoryId
    const articlesResult = await pool.query(
      `SELECT a.id, a.title, a.summary, a.tags, a."spaceId", ks.name as "spaceName"
      FROM articles a
      LEFT JOIN knowledge_spaces ks ON a."spaceId" = ks.id
      WHERE a."isPublished" = true
        AND (a.title ILIKE $1 OR a.summary ILIKE $1 OR a.tags::text ILIKE $1)
      ORDER BY a."order"
      LIMIT 20`,
      [searchTerm],
    );

    // Search glossary by term, definition, aliases (ILIKE)
    const glossaryResult = await pool.query(
      `SELECT id, term, definition, category, aliases
      FROM glossary_terms
      WHERE term ILIKE $1 OR definition ILIKE $1 OR aliases::text ILIKE $1
      ORDER BY "order"
      LIMIT 20`,
      [searchTerm],
    );

    // Search challenges by title, description (ILIKE)
    const challengesResult = await pool.query(
      `SELECT id, title, description, difficulty, type, category
      FROM challenges
      WHERE "isActive" = true
        AND (title ILIKE $1 OR description ILIKE $1)
      ORDER BY "order"
      LIMIT 20`,
      [searchTerm],
    );

    return NextResponse.json({
      articles: articlesResult.rows,
      glossary: glossaryResult.rows,
      challenges: challengesResult.rows,
    });
  } catch (error) {
    console.error("Knowledge search error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
