import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type");

    const conditions: string[] = ['"isActive" = true'];
    const params: unknown[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      params.push(category);
    }
    if (difficulty) {
      conditions.push(`difficulty = $${idx++}`);
      params.push(difficulty);
    }
    if (type) {
      conditions.push(`type = $${idx++}`);
      params.push(type);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const result = await query(
      `SELECT id, title, description, difficulty, type, category, "xpReward", "order", "skillId" FROM challenges ${whereClause} ORDER BY "order" ASC`,
      params,
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Challenges list error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
