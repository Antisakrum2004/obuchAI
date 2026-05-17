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
    let consecutiveCorrect = 0;
    let consecutiveWrong = 0;

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

        // Get adaptive difficulty state
        const userResult = await query(
          `SELECT "consecutiveCorrect", "consecutiveWrong" FROM users WHERE id = $1`,
          [userId]
        );
        if (userResult.rows.length > 0) {
          consecutiveCorrect = Number(userResult.rows[0].consecutiveCorrect || 0);
          consecutiveWrong = Number(userResult.rows[0].consecutiveWrong || 0);
        }
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

    // ★ Sort: active first, then blocked (cooldown), then solved at the bottom
    // Tiebreaker: preserve original "order" within each tier
    const now = new Date();
    challengesWithStatus.sort((a: { isSolved: boolean; cooldownUntil: string | null; order?: number; difficulty?: string }, b: { isSolved: boolean; cooldownUntil: string | null; order?: number; difficulty?: string }) => {
      const aSolved = a.isSolved;
      const bSolved = b.isSolved;
      const aBlocked = !aSolved && a.cooldownUntil && new Date(a.cooldownUntil) > now;
      const bBlocked = !bSolved && b.cooldownUntil && new Date(b.cooldownUntil) > now;

      // Tier priority: active(0) > blocked(1) > solved(2)
      const aTier = aSolved ? 2 : aBlocked ? 1 : 0;
      const bTier = bSolved ? 2 : bBlocked ? 1 : 0;

      if (aTier !== bTier) return aTier - bTier;

      // ★ Adaptive difficulty: re-order within active tier based on streak
      if (aTier === 0 && bTier === 0) {
        // If user has many correct in a row, show harder challenges first
        if (consecutiveCorrect >= 5) {
          const diffOrder: Record<string, number> = { hard: 0, medium: 1, easy: 2 };
          const aDiff = diffOrder[a.difficulty || "easy"] ?? 1;
          const bDiff = diffOrder[b.difficulty || "easy"] ?? 1;
          if (aDiff !== bDiff) return aDiff - bDiff;
        }
        // If user is struggling, show easier challenges first
        if (consecutiveWrong >= 3) {
          const diffOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          const aDiff = diffOrder[a.difficulty || "easy"] ?? 1;
          const bDiff = diffOrder[b.difficulty || "easy"] ?? 1;
          if (aDiff !== bDiff) return aDiff - bDiff;
        }
      }

      // Within same tier and difficulty preference, keep original order
      return (a.order ?? 0) - (b.order ?? 0);
    });

    // Determine difficultyBoost for the frontend
    let difficultyBoost: string | null = null;
    if (consecutiveCorrect >= 5) {
      difficultyBoost = "harder";
    } else if (consecutiveWrong >= 3) {
      difficultyBoost = "easier";
    }

    return NextResponse.json({
      challenges: challengesWithStatus,
      difficultyBoost,
    });
  } catch (error) {
    console.error("Challenges list error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
