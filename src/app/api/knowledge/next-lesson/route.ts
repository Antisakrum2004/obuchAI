import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Get the first published space and its first article
 * for the "Начать курс" button on the dashboard.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    // Get first published space ordered by `order`
    const spaceResult = await pool.query(
      `SELECT ks.id, ks.name, ks.slug, ks.description, ks.icon, ks."order"
       FROM knowledge_spaces ks
       WHERE ks."isPublished" = true
       ORDER BY ks."order" ASC
       LIMIT 1`
    );

    if (!spaceResult.rows[0]) {
      return NextResponse.json({ space: null, article: null });
    }

    const space = spaceResult.rows[0];

    // Get first article in that space
    const articleResult = await pool.query(
      `SELECT a.id, a.title, a.difficulty, a."estimatedTime"
       FROM articles a
       WHERE a."spaceId" = $1
         AND a.status = 'published'
       ORDER BY a."order" ASC, a."createdAt" ASC
       LIMIT 1`,
      [space.id]
    );

    const article = articleResult.rows[0] || null;

    return NextResponse.json({
      space: {
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        icon: space.icon,
      },
      article: article
        ? {
            id: article.id,
            title: article.title,
            difficulty: article.difficulty,
            estimatedTime: article.estimatedTime,
          }
        : null,
      // URL to navigate to
      pathUrl: article
        ? `/knowledge/${space.slug}/learn/${article.id}`
        : `/knowledge/${space.slug}`,
    });
  } catch (error) {
    console.error("[Next Lesson] Error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении данных" },
      { status: 500 }
    );
  }
}
