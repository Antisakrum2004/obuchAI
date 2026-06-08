import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";

// GET /api/knowledge/queue — List all processing queue items (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const articleId = searchParams.get("articleId");

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`pq.status = $${idx++}`);
      params.push(status);
    }

    if (type) {
      conditions.push(`pq.type = $${idx++}`);
      params.push(type);
    }

    if (articleId) {
      conditions.push(`pq."articleId" = $${idx++}`);
      params.push(articleId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT pq.id, pq.type, pq.status, pq."articleId", pq."inputData", pq.result, pq.error, pq.progress,
              pq."startedAt", pq."completedAt", pq."createdAt", pq."updatedAt",
              a.title as "articleTitle"
       FROM processing_queue pq
       LEFT JOIN articles a ON pq."articleId" = a.id
       ${whereClause}
       ORDER BY pq."createdAt" DESC`,
      params
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching processing queue:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки очереди обработки" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge/queue — Reset error items back to pending (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "reset-errors") {
      // Reset all error items back to pending
      const { rowCount } = await pool.query(
        `UPDATE processing_queue
         SET status = 'pending', error = NULL, progress = 0, "startedAt" = NULL, "completedAt" = NULL, "updatedAt" = NOW()
         WHERE status = 'error'`
      );

      // Also reset article status back to pending for errored articles
      await pool.query(
        `UPDATE articles SET status = 'pending', "errorMessage" = NULL, "updatedAt" = NOW()
         WHERE status = 'error'`
      );

      return NextResponse.json({
        message: `Сброшено ${rowCount} элементов очереди из ошибки в ожидание`,
        resetCount: rowCount,
      });
    }

    if (action === "clear-done") {
      // Remove completed items from the queue
      const { rowCount } = await pool.query(
        `DELETE FROM processing_queue WHERE status = 'done'`
      );

      return NextResponse.json({
        message: `Удалено ${rowCount} завершённых элементов из очереди`,
        deletedCount: rowCount,
      });
    }

    if (action === "create-content-tasks") {
      // Find articles that have a PDF (pdfUrl or media) but content is still placeholder,
      // and don't have a content_extract queue item yet
      const { rows: placeholderArticles } = await pool.query(
        `SELECT a.id, a.title, a."pdfUrl"
         FROM articles a
         WHERE (a.content LIKE '%Содержимое будет добавлено после обработки%' OR LENGTH(a.content) < 50)
           AND (a."pdfUrl" IS NOT NULL AND a."pdfUrl" != ''
                OR EXISTS (SELECT 1 FROM media m WHERE m."articleId" = a.id AND m."mimeType" LIKE 'application/pdf%'))
           AND NOT EXISTS (
             SELECT 1 FROM processing_queue pq
             WHERE pq."articleId" = a.id AND pq.type = 'content_extract' AND pq.status IN ('pending', 'processing')
           )`
      );

      let createdCount = 0;
      for (const article of placeholderArticles) {
        try {
          const queueId = genId("pq_");
          await pool.query(
            `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
             VALUES ($1, 'content_extract', 'pending', $2, $3, 0, NOW(), NOW())`,
            [queueId, article.id, JSON.stringify({ articleId: article.id, type: "content" })]
          );
          createdCount++;
        } catch {
          // Skip if insert fails (e.g., duplicate)
        }
      }

      return NextResponse.json({
        message: `Создано ${createdCount} задач извлечения контента для статей с PDF`,
        createdCount,
        totalFound: placeholderArticles.length,
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие. Доступные: reset-errors, clear-done, create-content-tasks" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in queue action:", error);
    return NextResponse.json(
      { error: "Ошибка при выполнении действия с очередью" },
      { status: 500 }
    );
  }
}
