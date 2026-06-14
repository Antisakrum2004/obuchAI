import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Build a dynamic ILIKE OR clause for multiple search terms across given fields.
 * Returns { sql: string, params: string[] } where params are the %term% values.
 *
 * Example output for fields=['a.title','a.summary'], terms=['%foo%','%bar%']:
 *   sql    = "(a.title ILIKE $1 OR a.summary ILIKE $1) OR (a.title ILIKE $2 OR a.summary ILIKE $2)"
 *   params = ['%foo%', '%bar%']
 */
function buildILikeOR(
  fields: string[],
  terms: string[],
  startIdx: number = 1,
): { sql: string; nextIdx: number } {
  const parts = terms.map((_, i) => {
    const idx = startIdx + i;
    const fieldConds = fields.map((f) => `${f} ILIKE $${idx}`).join(" OR ");
    return `(${fieldConds})`;
  });
  return { sql: parts.join(" OR "), nextIdx: startIdx + terms.length };
}

// GET /api/knowledge/search?q=searchterm&qAlt=alt1,alt2 — Global search across articles, glossary terms, and challenges
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ articles: [], glossary: [], challenges: [] });
    }

    // Collect all search patterns: primary + alternatives (for keyboard layout switching)
    const searchTerms: string[] = [`%${q.trim()}%`];

    const qAltRaw = searchParams.get("qAlt");
    if (qAltRaw) {
      const alts = qAltRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const alt of alts) {
        const pattern = `%${alt}%`;
        // Avoid duplicates
        if (!searchTerms.includes(pattern)) {
          searchTerms.push(pattern);
        }
      }
    }

    // ── Articles ──
    const artFields = ["a.title", "a.summary", "a.tags::text"];
    const artWhere = buildILikeOR(artFields, searchTerms);
    const articlesResult = await pool.query(
      `SELECT a.id, a.title, a.summary, a.tags, a."spaceId", ks.name as "spaceName"
       FROM articles a
       LEFT JOIN knowledge_spaces ks ON a."spaceId" = ks.id
       WHERE a."isPublished" = true
         AND (${artWhere.sql})
       ORDER BY a."createdAt" DESC
       LIMIT 20`,
      searchTerms,
    );

    // ── Glossary ──
    const glossFields = ["term", "definition", "aliases::text"];
    const glossWhere = buildILikeOR(glossFields, searchTerms);
    const glossaryResult = await pool.query(
      `SELECT id, term, definition, "shortDefinition", category, aliases, "relatedTerms"
       FROM glossary_terms
       WHERE ${glossWhere.sql}
       ORDER BY category ASC, term ASC
       LIMIT 20`,
      searchTerms,
    );

    // ── Challenges ──
    const chFields = ["title", "description"];
    const chWhere = buildILikeOR(chFields, searchTerms);
    const challengesResult = await pool.query(
      `SELECT id, title, description, difficulty, type, category
       FROM challenges
       WHERE "isActive" = true
         AND (${chWhere.sql})
       ORDER BY "order"
       LIMIT 20`,
      searchTerms,
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
