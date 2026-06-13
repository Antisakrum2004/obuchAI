import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/course-progress
 * 
 * Returns course progress for the current user:
 * - spaces with article counts and completion counts
 * - total articles completed / total articles
 * - next incomplete lesson
 * - current space progress
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

    // Get all published spaces ordered by `order`
    const spacesResult = await pool.query(
      `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order"
       FROM knowledge_spaces ks
       WHERE ks."isPublished" = true
       ORDER BY ks."order" ASC`
    );

    // Get total article count per space (published only)
    const articleCountsResult = await pool.query(
      `SELECT a."spaceId", COUNT(*)::int as total
       FROM articles a
       WHERE a.status = 'published'
       GROUP BY a."spaceId"`
    );
    const articleCounts = new Map<string, number>();
    for (const row of articleCountsResult.rows) {
      articleCounts.set(row.spaceId, row.total);
    }

    // Get completed articles for this user (from xp_logs with reason='lesson_complete')
    const completedResult = await pool.query(
      `SELECT DISTINCT x."referenceId" as article_id, a."spaceId"
       FROM xp_logs x
       JOIN articles a ON a.id = x."referenceId"
       WHERE x."userId" = $1
         AND x.reason = 'lesson_complete'
         AND a.status = 'published'`,
      [userId]
    );
    const completedArticleIds = new Set<string>();
    const completedPerSpace = new Map<string, number>();
    for (const row of completedResult.rows) {
      completedArticleIds.add(row.article_id);
      completedPerSpace.set(row.spaceId, (completedPerSpace.get(row.spaceId) || 0) + 1);
    }

    // Build spaces progress
    const spaces = spacesResult.rows.map((space) => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      icon: space.icon,
      order: space.order,
      totalArticles: articleCounts.get(space.id) || 0,
      completedArticles: completedPerSpace.get(space.id) || 0,
    }));

    // Calculate totals
    const totalArticles = spaces.reduce((sum, s) => sum + s.totalArticles, 0);
    const totalCompleted = spaces.reduce((sum, s) => sum + s.completedArticles, 0);

    // Find next incomplete lesson (first uncompleted article in the first space that has uncompleted articles)
    let nextLesson: { id: string; title: string; slug: string; spaceSlug: string; spaceName: string } | null = null;

    for (const space of spaces) {
      if (space.completedArticles < space.totalArticles) {
        // Find first uncompleted article in this space
        const nextResult = await pool.query(
          `SELECT a.id, a.title
           FROM articles a
           WHERE a."spaceId" = $1
             AND a.status = 'published'
             AND a.id NOT IN (
               SELECT DISTINCT x."referenceId"
               FROM xp_logs x
               WHERE x."userId" = $2
                 AND x.reason = 'lesson_complete'
             )
           ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC
           LIMIT 1`,
          [space.id, userId]
        );
        if (nextResult.rows[0]) {
          nextLesson = {
            id: nextResult.rows[0].id,
            title: nextResult.rows[0].title,
            slug: space.slug,
            spaceSlug: space.slug,
            spaceName: space.name,
          };
          break;
        }
      }
    }

    // If all completed, find the very first lesson (for "Повторить" scenario)
    let firstLesson: { id: string; title: string; slug: string; spaceName: string } | null = null;
    if (!nextLesson && spaces.length > 0) {
      const firstSpace = spaces[0];
      const firstResult = await pool.query(
        `SELECT a.id, a.title
         FROM articles a
         WHERE a."spaceId" = $1
           AND a.status = 'published'
         ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC
         LIMIT 1`,
        [firstSpace.id]
      );
      if (firstResult.rows[0]) {
        firstLesson = {
          id: firstResult.rows[0].id,
          title: firstResult.rows[0].title,
          slug: firstSpace.slug,
          spaceName: firstSpace.name,
        };
      }
    }

    const percentage = totalArticles > 0 ? Math.round((totalCompleted / totalArticles) * 100) : 0;
    const hasStarted = totalCompleted > 0;
    const isComplete = totalArticles > 0 && totalCompleted >= totalArticles;

    // Get articles per space with completion status (for course map page)
    const articlesBySpace: Record<string, Array<{ id: string; title: string; difficulty: string | null; estimatedTime: string | null; complexityOrder: number | null; completed: boolean }>> = {};
    for (const space of spaces) {
      if (space.totalArticles === 0) continue;
      const articlesResult = await pool.query(
        `SELECT a.id, a.title, a.difficulty, a."estimatedTime", a."complexityOrder"
         FROM articles a
         WHERE a."spaceId" = $1
           AND a.status = 'published'
         ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC`,
        [space.id]
      );
      articlesBySpace[space.id] = articlesResult.rows.map((a: { id: string; title: string; difficulty: string | null; estimatedTime: string | null; complexityOrder: number | null }) => ({
        id: a.id,
        title: a.title,
        difficulty: a.difficulty,
        estimatedTime: a.estimatedTime,
        complexityOrder: a.complexityOrder,
        completed: completedArticleIds.has(a.id),
      }));
    }

    return NextResponse.json({
      spaces,
      totalArticles,
      totalCompleted,
      percentage,
      hasStarted,
      isComplete,
      nextLesson,
      firstLesson,
      articlesBySpace,
    });
  } catch (error) {
    console.error("[Course Progress] Error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении данных" },
      { status: 500 }
    );
  }
}
