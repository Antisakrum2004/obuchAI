import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    // Get user attempt info if logged in
    let solvedIds = new Set<string>();
    let cooldownMap = new Map<string, Date>();

    const session = await getServerSession(authOptions);
    if (session?.user) {
      const userId = (session.user as Record<string, unknown>).id as string;
      if (userId) {
        // Get all correct attempts for this user
        const solvedResult = await query(
          `SELECT DISTINCT "challengeId" FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true`,
          [userId]
        );
        solvedResult.rows.forEach((r: { challengeId: string }) => solvedIds.add(r.challengeId));

        // Get last wrong attempt for each challenge (for cooldown)
        const wrongResult = await query(
          `SELECT "challengeId", MAX("createdAt") as "lastWrongAt" FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = false GROUP BY "challengeId"`,
          [userId]
        );
        wrongResult.rows.forEach((r: { challengeId: string; lastWrongAt: string }) => {
          cooldownMap.set(r.challengeId, new Date(r.lastWrongAt));
        });
      }
    }

    // 4-hour cooldown in milliseconds
    const COOLDOWN_MS = 4 * 60 * 60 * 1000;

    const challengesWithStatus = result.rows.map((ch: { id: string; [key: string]: unknown }) => {
      const isSolved = solvedIds.has(ch.id);
      let cooldownUntil: string | null = null;

      if (!isSolved && cooldownMap.has(ch.id)) {
        const lastWrong = cooldownMap.get(ch.id)!;
        const cooldownEnd = new Date(lastWrong.getTime() + COOLDOWN_MS);
        if (cooldownEnd > new Date()) {
          cooldownUntil = cooldownEnd.toISOString();
        }
      }

      return { ...ch, isSolved: Boolean(isSolved), cooldownUntil: cooldownUntil || null };
    });

    // ★ Sort: unsolved first, solved at the bottom
    challengesWithStatus.sort((a: { isSolved: boolean; order?: number }, b: { isSolved: boolean; order?: number }) => {
      if (a.isSolved && !b.isSolved) return 1;
      if (!a.isSolved && b.isSolved) return -1;
      return 0;
    });

    return NextResponse.json(challengesWithStatus);
  } catch (error) {
    console.error("Challenges list error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
