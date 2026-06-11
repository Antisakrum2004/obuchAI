import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/spaces/[id]/path
 *
 * Returns the topological ordering of articles within a space,
 * based on their `prerequisites` field. Also returns each article's
 * quiz/practical_task/timecodes availability flags.
 *
 * Algorithm: Kahn's topological sort (BFS).
 * Articles without prerequisites come first (rank 0),
 * then articles whose prerequisites are all satisfied, etc.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: spaceId } = await params;

    // Fetch all published/done articles in this space
    // Try with Sprint 7 columns first; fall back if they don't exist yet
    let articles: any[];
    let hasSprint7 = true;
    try {
      const result = await pool.query(
        `SELECT id, title, slug, summary, difficulty, prerequisites, "estimatedTime",
                quiz, practical_task, timecodes, "videoUrl", "keyConcepts"
         FROM articles
         WHERE "spaceId" = $1 AND status IN ('done') AND "isPublished" = true
         ORDER BY "createdAt" ASC`,
        [spaceId]
      );
      articles = result.rows;
    } catch (queryErr: any) {
      if (queryErr?.code === '42703' || /does not exist/.test(queryErr?.message || '')) {
        console.warn('[Learning Path API] Sprint 7 columns missing, falling back');
        hasSprint7 = false;
        const result = await pool.query(
          `SELECT id, title, slug, summary, difficulty, prerequisites, "estimatedTime",
                  "videoUrl", "keyConcepts"
           FROM articles
           WHERE "spaceId" = $1 AND status IN ('done') AND "isPublished" = true
           ORDER BY "createdAt" ASC`,
          [spaceId]
        );
        articles = result.rows;
      } else {
        throw queryErr;
      }
    }

    if (articles.length === 0) {
      return NextResponse.json({
        spaceId,
        path: [],
        totalArticles: 0,
      });
    }

    // Build article lookup map
    const articleMap = new Map<string, (typeof articles)[0]>();
    for (const a of articles) {
      articleMap.set(a.id, a);
    }

    // Parse prerequisites for each article (only keep valid IDs within this space)
    const prereqsMap = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const a of articles) {
      let parsedPrereqs: string[] = [];
      try {
        parsedPrereqs = a.prerequisites ? JSON.parse(a.prerequisites as string) : [];
      } catch {
        parsedPrereqs = [];
      }

      // Filter to only include prerequisites that exist in this space
      const validPrereqs = parsedPrereqs.filter((pid: string) => articleMap.has(pid));
      prereqsMap.set(a.id, new Set(validPrereqs));
      inDegree.set(a.id, validPrereqs.length);
    }

    // Kahn's algorithm: BFS topological sort
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted: string[] = [];
    const ranks = new Map<string, number>();

    // Assign rank 0 to articles with no prerequisites
    for (const id of queue) {
      ranks.set(id, 0);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const currentRank = ranks.get(current) || 0;

      // Find all articles that depend on current
      for (const [articleId, prereqs] of prereqsMap) {
        if (prereqs.has(current)) {
          const newDegree = (inDegree.get(articleId) || 1) - 1;
          inDegree.set(articleId, newDegree);

          // Rank = max(rank of all prerequisites) + 1
          const existingRank = ranks.get(articleId) || 0;
          ranks.set(articleId, Math.max(existingRank, currentRank + 1));

          if (newDegree === 0) {
            queue.push(articleId);
          }
        }
      }
    }

    // Handle articles not reached by topological sort (cycle or disconnected)
    // Add them at the end with rank based on their position
    for (const a of articles) {
      if (!sorted.includes(a.id)) {
        sorted.push(a.id);
        if (!ranks.has(a.id)) {
          ranks.set(a.id, 1);
        }
      }
    }

    // Build the result with article details
    const pathResult = sorted.map((id) => {
      const a = articleMap.get(id)!;
      return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        difficulty: a.difficulty,
        estimatedTime: a.estimatedTime,
        rank: ranks.get(id) || 0,
        hasQuiz: hasSprint7 ? !!(a.quiz && (typeof a.quiz === "object" && Array.isArray(a.quiz) ? a.quiz.length > 0 : false)) : false,
        hasPractice: hasSprint7 ? !!a.practical_task : false,
        hasTimecodes: hasSprint7 ? !!(a.timecodes && (typeof a.timecodes === "object" && Array.isArray(a.timecodes) ? a.timecodes.length > 0 : false)) : false,
        hasVideo: !!a.videoUrl,
        keyConcepts: a.keyConcepts ? (typeof a.keyConcepts === "string" ? JSON.parse(a.keyConcepts as string) : a.keyConcepts) : [],
      };
    });

    // Group by rank for the learning path visualization
    const maxRank = Math.max(...Array.from(ranks.values()), 0);
    const levels: Array<{ rank: number; articles: typeof pathResult }> = [];

    // Difficulty sort order for within-rank ordering
    const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

    for (let r = 0; r <= maxRank; r++) {
      const articlesAtRank = pathResult
        .filter((a) => a.rank === r)
        .sort((a, b) => {
          // Within same rank, sort by difficulty (easy first)
          const diffA = difficultyOrder[a.difficulty || "medium"] ?? 1;
          const diffB = difficultyOrder[b.difficulty || "medium"] ?? 1;
          return diffA - diffB;
        });
      if (articlesAtRank.length > 0) {
        levels.push({ rank: r, articles: articlesAtRank });
      }
    }

    return NextResponse.json({
      spaceId,
      path: pathResult,
      levels,
      totalArticles: articles.length,
      maxRank,
    });
  } catch (error) {
    console.error("Error fetching learning path:", error);
    return NextResponse.json(
      { error: "Ошибка при получении пути обучения" },
      { status: 500 }
    );
  }
}
