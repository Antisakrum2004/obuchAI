import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, term, definition, "shortDefinition", category, aliases, "relatedTerms"
       FROM glossary_terms
       ORDER BY category ASC, term ASC`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching glossary:", error);
    return NextResponse.json([]);
  }
}

// POST /api/knowledge/glossary — Create glossary term (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { term, definition, shortDefinition, category, aliases, relatedTerms, sourceArticleId, order } = body;

    if (!term || !definition) {
      return NextResponse.json(
        { error: "term и definition обязательны" },
        { status: 400 }
      );
    }

    // Check term uniqueness
    const existing = await pool.query(
      `SELECT id FROM glossary_terms WHERE term = $1`,
      [term]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Термин с таким названием уже существует" },
        { status: 409 }
      );
    }

    const id = 'gt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    const result = await pool.query(
      `INSERT INTO glossary_terms (id, term, definition, "shortDefinition", category, aliases, "relatedTerms", "sourceArticleId", "order", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        id,
        term,
        definition,
        shortDefinition || null,
        category || null,
        aliases ? JSON.stringify(aliases) : null,
        relatedTerms ? JSON.stringify(relatedTerms) : null,
        sourceArticleId || null,
        order || 0,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating glossary term:", error);
    return NextResponse.json(
      { error: "Ошибка создания термина" },
      { status: 500 }
    );
  }
}
