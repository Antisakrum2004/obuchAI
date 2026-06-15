import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";

// GET /api/knowledge/queue — List all processing queue items (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
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
    if (!session?.user || session.user.role !== "admin") {
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

    if (action === "clear-pending") {
      // Remove ALL pending items from the queue (with their article status reset)
      const { rowCount } = await pool.query(
        `DELETE FROM processing_queue WHERE status = 'pending'`
      );

      return NextResponse.json({
        message: `Удалено ${rowCount} ожидающих элементов из очереди`,
        deletedCount: rowCount,
      });
    }

    if (action === "clear-all") {
      // Remove ALL items from the queue (pending + error + done)
      const { rowCount } = await pool.query(
        `DELETE FROM processing_queue`
      );

      // Reset articles that were stuck in processing/error
      await pool.query(
        `UPDATE articles SET status = 'pending', "errorMessage" = NULL, "updatedAt" = NOW()
         WHERE status IN ('processing', 'error')`
      );

      return NextResponse.json({
        message: `Очередь полностью очищена (${rowCount} элементов)`,
        deletedCount: rowCount,
      });
    }

    if (action === "reset-stuck") {
      // Reset articles that have been stuck in 'processing' status for too long
      // (more than 10 minutes with no queue progress = likely stuck)
      const { rows: stuckArticles } = await pool.query(
        `SELECT id, title, "updatedAt" FROM articles
         WHERE status = 'processing'
           AND "updatedAt" < NOW() - INTERVAL '10 minutes'`
      );

      // Reset stuck articles back to pending
      const { rowCount: resetCount } = await pool.query(
        `UPDATE articles SET status = 'pending', "errorMessage" = NULL, "updatedAt" = NOW()
         WHERE status = 'processing'
           AND "updatedAt" < NOW() - INTERVAL '10 minutes'`
      );

      // Reset stuck queue items (processing for > 10 min) back to pending
      const { rowCount: queueResetCount } = await pool.query(
        `UPDATE processing_queue SET status = 'pending', progress = 0, "startedAt" = NULL, "updatedAt" = NOW()
         WHERE status = 'processing'
           AND "updatedAt" < NOW() - INTERVAL '10 minutes'`
      );

      return NextResponse.json({
        message: `Сброшено ${resetCount} зависших статей и ${queueResetCount} задач очереди`,
        resetArticlesCount: resetCount,
        resetQueueCount: queueResetCount,
        stuckArticles: stuckArticles.map((a: { id: string; title: string }) => ({ id: a.id, title: a.title })),
      });
    }

    if (action === "ensure-queue-items") {
      // Ensure an article has all processing queue items (content, metadata, glossary, graph, course)
      // Creates missing items without touching existing ones
      const { articleId } = body as { articleId?: string };
      if (!articleId) {
        return NextResponse.json({ error: "articleId обязателен" }, { status: 400 });
      }

      // Check article's sourceType and PDF status (for content_extract)
      const { rows: articleRows } = await pool.query(
        `SELECT "pdfUrl", "sourceType", "videoUrl" FROM articles WHERE id = $1`,
        [articleId]
      );
      const article = articleRows[0];
      const hasPdf = article?.pdfUrl;
      const sourceType = article?.sourceType || "";
      const isVideoArticle = ["youtube", "rutube", "vk", "local", "video"].includes(sourceType) ||
        (article?.videoUrl && !hasPdf);
      // Also check media table for PDF
      let hasMediaPdf = false;
      if (!hasPdf) {
        const { rows: mediaCheck } = await pool.query(
          `SELECT id FROM media WHERE "articleId" = $1 AND "mimeType" LIKE 'application/pdf%' LIMIT 1`,
          [articleId]
        );
        hasMediaPdf = mediaCheck.length > 0;
      }

      const requiredTypes: string[] = [];
      // Skip content_extract for video articles — they don't need PDF extraction
      if ((hasPdf || hasMediaPdf) && !isVideoArticle) requiredTypes.push("content_extract");
      requiredTypes.push("ai_metadata", "glossary_extract", "graph_build", "course_draft");

      // Get existing queue items for this article
      const { rows: existingItems } = await pool.query(
        `SELECT type, status FROM processing_queue WHERE "articleId" = $1`,
        [articleId]
      );
      const existingTypes = new Set(existingItems.map((i: { type: string }) => i.type));

      let createdCount = 0;
      for (const type of requiredTypes) {
        if (!existingTypes.has(type)) {
          const queueId = genId("pq_");
          await pool.query(
            `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
             VALUES ($1, $2, 'pending', $3, $4, 0, NOW(), NOW())`,
            [queueId, type, articleId, JSON.stringify({ articleId, type: type.replace("_extract", "").replace("ai_", "").replace("graph_build", "graph") })]
          );
          createdCount++;
        }
      }

      return NextResponse.json({
        message: `Создано ${createdCount} задач для статьи`,
        createdCount,
        requiredTypes,
        existingTypes: [...existingTypes],
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

    if (action === "publish-without-ai") {
      // Publish an article immediately without AI processing
      // Sets isPublished=true, status=done, removes all queue items for that article
      const { articleId } = body as { articleId?: string };
      if (!articleId) {
        return NextResponse.json({ error: "articleId обязателен" }, { status: 400 });
      }

      // Check article exists and is not already published
      const { rows: articleRows } = await pool.query(
        `SELECT id, status, "isPublished" FROM articles WHERE id = $1`,
        [articleId]
      );

      if (articleRows.length === 0) {
        return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
      }

      // Update article: publish + set status done + replace placeholder content
      const { rows: updated } = await pool.query(
        `UPDATE articles 
         SET "isPublished" = true, 
             status = 'done', 
             "errorMessage" = NULL,
             content = CASE 
               WHEN content LIKE '%Содержимое будет добавлено после обработки%' OR LENGTH(COALESCE(content, '')) < 50
               THEN '*Материал загружен и опубликован без AI-обработки.*'
               ELSE content
             END,
             "updatedAt" = NOW()
         WHERE id = $1
         RETURNING id, title, status, "isPublished"`,
        [articleId]
      );

      // Delete ALL queue items for this article (no more AI processing needed)
      const { rowCount: deletedQueue } = await pool.query(
        `DELETE FROM processing_queue WHERE "articleId" = $1`,
        [articleId]
      );

      return NextResponse.json({
        message: `Статья «${updated[0]?.title || articleId}» опубликована без AI-обработки`,
        article: updated[0],
        deletedQueueItems: deletedQueue,
      });
    }

    if (action === "fix-video-articles") {
      // Fix video articles that are stuck in pending/error status
      // Video articles (youtube/rutube/vk/local) should be published immediately
      // since their content comes from the video URL, not PDF extraction
      const { rows: videoArticles } = await pool.query(
        `SELECT id, title, "sourceType", "videoUrl", status, "isPublished"
         FROM articles
         WHERE "sourceType" IN ('youtube', 'rutube', 'vk', 'local')
           AND (status IN ('pending', 'processing', 'error') OR "isPublished" = false)`
      );

      let fixedCount = 0;
      for (const article of videoArticles) {
        try {
          // Remove content_extract queue items — video articles don't need PDF extraction
          await pool.query(
            `DELETE FROM processing_queue WHERE "articleId" = $1 AND type = 'content_extract'`,
            [article.id]
          );

          // Set remaining error/pending items back to pending so they can be reprocessed
          await pool.query(
            `UPDATE processing_queue SET status = 'pending', error = NULL, progress = 0, "startedAt" = NULL, "completedAt" = NULL, "updatedAt" = NOW()
             WHERE "articleId" = $1 AND status = 'error'`,
            [article.id]
          );

          // Publish the article immediately
          await pool.query(
            `UPDATE articles
             SET status = 'done',
                 "isPublished" = true,
                 "errorMessage" = NULL,
                 content = CASE
                   WHEN content LIKE '%Содержимое будет добавлено после обработки%' OR LENGTH(COALESCE(content, '')) < 50
                   THEN '*Видеоматериал. Основной контент — видеоурок.*'
                   ELSE content
                 END,
                 "updatedAt" = NOW()
             WHERE id = $1`,
            [article.id]
          );
          fixedCount++;
        } catch (err) {
          console.error(`[fix-video-articles] Failed to fix article ${article.id}:`, err);
        }
      }

      return NextResponse.json({
        message: `Исправлено ${fixedCount} из ${videoArticles.length} видео-статей`,
        fixedCount,
        totalFound: videoArticles.length,
        articles: videoArticles.map((a: { id: string; title: string; sourceType: string; status: string }) => ({
          id: a.id,
          title: a.title,
          sourceType: a.sourceType,
          status: a.status,
        })),
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие. Доступные: reset-errors, clear-done, clear-pending, clear-all, reset-stuck, ensure-queue-items, create-content-tasks, publish-without-ai, fix-video-articles" },
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
