import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (type) where.type = type;

    const challenges = await db.challenge.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        type: true,
        category: true,
        xpReward: true,
        order: true,
        skillId: true,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(challenges);
  } catch (error) {
    console.error("Challenges list error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
