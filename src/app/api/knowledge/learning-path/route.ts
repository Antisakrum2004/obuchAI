import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

interface LearningModule {
  id: string;
  number: number;
  title: string;
  slug: string;
  status: "completed" | "current" | "locked";
  /** URL to the first accessible article in this module */
  href: string | null;
  /** Article info for the current/next lesson */
  article: {
    id: string;
    title: string;
    difficulty: string | null;
    estimatedTime: string | null;
  } | null;
  /** Progress within this module */
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * GET /api/knowledge/learning-path
 *
 * Returns the full learning path for the dashboard:
 * - Ordered list of modules (knowledge_spaces) with real progress
 * - Status: completed / current / locked
 * - First accessible article per module with direct URL
 * - Progress percentages
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    if (!userId) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    // 1. Get all published spaces ordered by `order`
    const spacesResult = await pool.query(
      `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order"
       FROM knowledge_spaces ks
       WHERE ks."isPublished" = true
       ORDER BY ks."order" ASC`
    );

    if (spacesResult.rows.length === 0) {
      return NextResponse.json({ modules: [], currentModule: null });
    }

    // 2. Get article counts per space (published + pending)
    const articleCountsResult = await pool.query(
      `SELECT a."spaceId", COUNT(*)::int as total
       FROM articles a
       WHERE a.status IN ('published', 'pending')
       GROUP BY a."spaceId"`
    );
    const articleCounts = new Map<string, number>();
    for (const row of articleCountsResult.rows) {
      articleCounts.set(row.spaceId, row.total);
    }

    // 3. Get completed articles for this user
    const completedResult = await pool.query(
      `SELECT DISTINCT x."referenceId" as article_id, a."spaceId"
       FROM xp_logs x
       JOIN articles a ON a.id = x."referenceId"
       WHERE x."userId" = $1
         AND x.reason = 'lesson_complete'
         AND a.status IN ('published', 'pending')`,
      [userId]
    );
    const completedPerSpace = new Map<string, Set<string>>();
    for (const row of completedResult.rows) {
      if (!completedPerSpace.has(row.spaceId)) {
        completedPerSpace.set(row.spaceId, new Set());
      }
      completedPerSpace.get(row.spaceId)!.add(row.article_id);
    }

    // 4. Build modules with progress and status
    const modules: LearningModule[] = [];
    let currentModuleIndex = -1;

    for (let i = 0; i < spacesResult.rows.length; i++) {
      const space = spacesResult.rows[i];
      const totalArticles = articleCounts.get(space.id) || 0;
      const completedArticleIds = completedPerSpace.get(space.id) || new Set<string>();
      const completedCount = totalArticles > 0
        ? [...completedArticleIds].filter(id => {
            // Count only articles that belong to this space
            return true; // already filtered by query
          }).length
        : 0;

      // Determine status — will be corrected after loop
      let status: "completed" | "current" | "locked" = "locked";

      if (totalArticles === 0) {
        // No articles → locked ("скоро")
        status = "locked";
      } else if (completedCount >= totalArticles) {
        status = "completed";
      } else {
        // First non-completed module = current, rest = locked
        // Will be corrected below after full iteration
        status = "current";
      }

      const percentage = totalArticles > 0 ? Math.round((completedCount / totalArticles) * 100) : 0;

      modules.push({
        id: space.id,
        number: i + 1,
        title: space.name,
        slug: space.slug,
        status, // temporary, will fix below
        href: null,
        article: null,
        progress: {
          completed: completedCount,
          total: totalArticles,
          percentage,
        },
      });
    }

    // 5. Fix statuses: first non-completed module = current, rest = locked
    let foundCurrent = false;
    for (const mod of modules) {
      if (mod.progress.total === 0) {
        mod.status = "locked"; // no articles
        continue;
      }
      if (mod.status === "completed") continue;

      if (!foundCurrent) {
        mod.status = "current";
        foundCurrent = true;
      } else {
        mod.status = "locked";
      }
    }

    // 6. For current and completed modules, find the first accessible article
    for (const mod of modules) {
      if (mod.status === "locked") continue;
      if (mod.progress.total === 0) continue;

      const completedIds = completedPerSpace.get(mod.id) || new Set<string>();

      // For current module: find first uncompleted article
      // For completed module: find first article (for review)
      if (mod.status === "current") {
        const articleResult = await pool.query(
          `SELECT a.id, a.title, a.difficulty, a."estimatedTime"
           FROM articles a
           WHERE a."spaceId" = $1
             AND a.status IN ('published', 'pending')
             AND a.id NOT IN (
               SELECT DISTINCT x."referenceId"
               FROM xp_logs x
               WHERE x."userId" = $2
                 AND x.reason = 'lesson_complete'
             )
           ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC
           LIMIT 1`,
          [mod.id, userId]
        );
        if (articleResult.rows[0]) {
          mod.article = {
            id: articleResult.rows[0].id,
            title: articleResult.rows[0].title,
            difficulty: articleResult.rows[0].difficulty,
            estimatedTime: articleResult.rows[0].estimatedTime,
          };
          mod.href = `/knowledge/${mod.slug}/learn/${articleResult.rows[0].id}`;
        }
      } else {
        // Completed module — link to first article for review
        const articleResult = await pool.query(
          `SELECT a.id, a.title, a.difficulty, a."estimatedTime"
           FROM articles a
           WHERE a."spaceId" = $1
             AND a.status IN ('published', 'pending')
           ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC
           LIMIT 1`,
          [mod.id]
        );
        if (articleResult.rows[0]) {
          mod.article = {
            id: articleResult.rows[0].id,
            title: articleResult.rows[0].title,
            difficulty: articleResult.rows[0].difficulty,
            estimatedTime: articleResult.rows[0].estimatedTime,
          };
          mod.href = `/knowledge/${mod.slug}/learn/${articleResult.rows[0].id}`;
        }
      }
    }

    // 7. Find current module info for the hero block
    const currentModule = modules.find(m => m.status === "current") || null;

    // 8. Calculate XP for current lesson
    let currentLessonXp = 50; // default
    if (currentModule?.article) {
      const diff = currentModule.article.difficulty;
      if (diff === "easy") currentLessonXp = 30;
      else if (diff === "medium") currentLessonXp = 50;
      else if (diff === "hard") currentLessonXp = 80;
    }

    return NextResponse.json({
      modules,
      currentModule: currentModule ? {
        ...currentModule,
        lessonXp: currentLessonXp,
      } : null,
      totalModules: modules.length,
      completedModules: modules.filter(m => m.status === "completed").length,
    });
  } catch (error) {
    console.error("[Learning Path] Error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении данных" },
      { status: 500 }
    );
  }
}
