import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const terms = await db.glossaryTerm.findMany({
      orderBy: [{ category: "asc" }, { term: "asc" }],
      select: {
        id: true,
        term: true,
        definition: true,
        shortDefinition: true,
        category: true,
        relatedTerms: true,
      },
    });

    return NextResponse.json(terms);
  } catch (error) {
    console.error("Error fetching glossary:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки глоссария" },
      { status: 500 }
    );
  }
}
