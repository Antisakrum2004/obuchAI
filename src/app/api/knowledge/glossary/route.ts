import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, term, definition, "shortDefinition", category, "relatedTerms"
       FROM glossary_terms
       ORDER BY category ASC, term ASC`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching glossary:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки глоссария" },
      { status: 500 }
    );
  }
}
