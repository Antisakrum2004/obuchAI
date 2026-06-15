import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";
import { storageProvider, S3StorageProvider } from "@/lib/storage";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // AI processing can take 30-90s per step

// POST /api/knowledge/ai — Execute AI processing for an article (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    // Rate limit: 5 AI requests per minute per user
    const rateResult = checkRateLimit(`ai:${session.user.id}`, RATE_LIMITS.ai);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов к AI. Подождите минуту." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { articleId, type } = body as { articleId?: string; type?: string };

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId обязателен" },
        { status: 400 }
      );
    }

    const validTypes = ["content", "metadata", "glossary", "graph", "categorize", "course"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type обязателен и должен быть одним из: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // All types need AI (content extraction uses AI to format PDF text into Markdown)
    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          error: "AI-сервис не настроен",
          details: "Добавьте OPENROUTER_API_KEY в переменные окружения Vercel (Settings → Environment Variables).",
          code: "AI_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    // Fetch the article
    const { rows: articleRows } = await pool.query(
      `SELECT id, title, content, summary, tags, "keyTopics", "spaceId", "pdfUrl", "pptxUrl", "sourceUrl", "sourceType", "videoUrl", status FROM articles WHERE id = $1`,
      [articleId]
    );

    if (articleRows.length === 0) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    const article = articleRows[0];

    // ── Skip if article is already being processed by another request ──
    // This prevents duplicate processing when both server-side waitUntil()
    // and client-side trigger fire for the same article.
    if (article.status === "processing" || article.status === "done") {
      // Check if the queue entry for this type is already done/processing
      const queueTypeMap: Record<string, string> = {
        content: "content_extract",
        metadata: "ai_metadata",
        glossary: "glossary_extract",
        graph: "graph_build",
        categorize: "ai_metadata",
        course: "course_draft",
      };
      const qt = queueTypeMap[type];
      const { rows: activeQueue } = await pool.query(
        `SELECT id, status FROM processing_queue WHERE "articleId" = $1 AND type = $2 AND status IN ('processing', 'done') LIMIT 1`,
        [articleId, qt]
      );
      if (activeQueue.length > 0) {
        console.log(`[AI] Skipping ${type} for article ${articleId} — already ${activeQueue[0].status}`);
        return NextResponse.json({
          message: `Задача '${type}' уже ${activeQueue[0].status === "done" ? "выполнена" : "выполняется"}`,
          skipped: true,
          articleId,
        });
      }
    }

    // Update article status to 'processing'
    await pool.query(
      `UPDATE articles SET status = 'processing', "updatedAt" = NOW() WHERE id = $1`,
      [articleId]
    );

    // Find or create the processing queue entry
    const queueTypeMap: Record<string, string> = {
      content: "content_extract",
      metadata: "ai_metadata",
      glossary: "glossary_extract",
      graph: "graph_build",
      categorize: "ai_metadata",
      course: "course_draft",
    };
    const queueType = queueTypeMap[type];

    // Find existing pending/processing/error queue entry, or create one
    // Include 'error' status to support retry on failed items
    let { rows: queueRows } = await pool.query(
      `SELECT id, status FROM processing_queue WHERE "articleId" = $1 AND type = $2 AND status IN ('pending', 'processing', 'error') ORDER BY "createdAt" DESC LIMIT 1`,
      [articleId, queueType]
    );

    let queueId: string;
    if (queueRows.length > 0) {
      queueId = queueRows[0].id;
      // If retrying an error, also reset the article status
      if (queueRows[0].status === "error") {
        await pool.query(
          `UPDATE articles SET status = 'pending', "errorMessage" = NULL, "updatedAt" = NOW() WHERE id = $1 AND status = 'error'`,
          [articleId]
        );
        console.log(`[AI] Retrying error item ${queueId} for article ${articleId}`);
      }
    } else {
      queueId = genId("pq_");
      await pool.query(
        `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "startedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 'processing', $3, $4, 0, NOW(), NOW(), NOW())`,
        [queueId, queueType, articleId, JSON.stringify({ articleId, type })]
      );
    }

    // Update queue entry to 'processing'
    await pool.query(
      `UPDATE processing_queue SET status = 'processing', "startedAt" = NOW(), progress = 10, "updatedAt" = NOW() WHERE id = $1`,
      [queueId]
    );

    try {
      if (type === "content") {
        // Skip content extraction for video articles — they don't have PDF content
        const sourceType = (article.sourceType as string) || "";
        const videoUrl = (article.videoUrl as string) || "";
        const isVideoArticle = ["youtube", "rutube", "vk", "local", "video"].includes(sourceType) ||
          (videoUrl && !article.pdfUrl);
        if (isVideoArticle) {
          console.log(`[AI] Skipping content extraction for video article ${articleId} (sourceType=${sourceType})`);
          // Mark queue item as done immediately
          await pool.query(
            `UPDATE processing_queue SET status = 'done', progress = 100, "completedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
            [queueId]
          );
        } else {
          await processContentExtraction(article, articleId, queueId);
        }
      } else if (type === "metadata" || type === "categorize") {
        // Check if we need auto-categorization (article has no spaceId)
        const needsCategorization = !article.spaceId;
        if (needsCategorization) {
          await processCategorization(article, articleId, queueId);
        }
        // Always process metadata (includes categorization if needed)
        await processMetadata(article, articleId, queueId);
      } else if (type === "glossary") {
        await processGlossary(article, articleId, queueId);
      } else if (type === "graph") {
        await processGraph(articleId, queueId);
      } else if (type === "course") {
        await processCourseContent(article, articleId, queueId);
      }

      // Update article status to 'done'
      await pool.query(
        `UPDATE articles SET status = 'done', "processedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
        [articleId]
      );

      // Update queue entry to 'done'
      await pool.query(
        `UPDATE processing_queue SET status = 'done', progress = 100, "completedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
        [queueId]
      );

      // Auto-publish: only if ALL expected queue items for the article are done.
      // Expected types: content_extract (if PDF), ai_metadata, glossary_extract, graph_build, course_draft
      // We ensure all expected queue entries exist before checking, to prevent premature auto-publish
      // when only the first step (e.g., metadata) has completed but glossary/course entries don't exist yet.
      const { rows: currentQueueItems } = await pool.query(
        `SELECT type, status FROM processing_queue WHERE "articleId" = $1`,
        [articleId]
      );

      // Determine expected queue types for this article
      const expectedTypes = ["ai_metadata", "glossary_extract", "graph_build", "course_draft"];
      // Check if article has PDF AND is not a video article → needs content_extract too
      const { rows: articlePdfCheck } = await pool.query(
        `SELECT "pdfUrl", "sourceType", "videoUrl" FROM articles WHERE id = $1`,
        [articleId]
      );
      const isVideoForAutoPublish = articlePdfCheck[0]?.videoUrl &&
        ["youtube", "rutube", "vk", "local", "video"].includes(articlePdfCheck[0]?.sourceType || "");
      if (articlePdfCheck[0]?.pdfUrl && !isVideoForAutoPublish) {
        expectedTypes.unshift("content_extract");
      }

      // Create missing queue entries for expected types that don't exist yet
      for (const expectedType of expectedTypes) {
        const exists = currentQueueItems.some((r: { type: string }) => r.type === expectedType);
        if (!exists) {
          const missingQueueId = genId("pq_");
          await pool.query(
            `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
             VALUES ($1, $2, 'pending', $3, $4, 0, NOW(), NOW())`,
            [missingQueueId, expectedType, articleId, JSON.stringify({ articleId, type: expectedType })]
          );
          console.log(`[AI] Created missing queue entry: ${expectedType} for article ${articleId}`);
        }
      }

      // Re-fetch queue items after creating missing ones
      const { rows: remainingItems } = await pool.query(
        `SELECT type, status FROM processing_queue WHERE "articleId" = $1`,
        [articleId]
      );
      const hasPending = remainingItems.some((r: { status: string }) => r.status === "pending" || r.status === "processing");
      const allDone = remainingItems.length > 0 && !hasPending && remainingItems.every((r: { status: string }) => r.status === "done");
      let skippedPublish = false;

      if (allDone) {
        // Check if article content is still a placeholder
        const { rows: contentCheck } = await pool.query(
          `SELECT content, "pdfUrl" FROM articles WHERE id = $1`,
          [articleId]
        );
        const content = contentCheck[0]?.content || "";
        const hasPdf = !!contentCheck[0]?.pdfUrl;
        const isPlaceholder = content.includes("Содержимое будет добавлено после обработки") || content.length < 50;

        if (isPlaceholder && hasPdf) {
          skippedPublish = true;
          console.log(`[AI] Article ${articleId} all tasks done but content is placeholder — not publishing`);
          await pool.query(
            `UPDATE articles SET status = 'done', "isPublished" = false, "updatedAt" = NOW() WHERE id = $1`,
            [articleId]
          );
        } else {
          // Publish the article (mark as done + published)
          await pool.query(
            `UPDATE articles SET status = 'done', "isPublished" = true, "processedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
            [articleId]
          );
          console.log(`[AI] Article ${articleId} fully processed — published`);
        }
        // Remove completed queue items for this article
        await pool.query(
          `DELETE FROM processing_queue WHERE "articleId" = $1 AND status = 'done'`,
          [articleId]
        );
      } else {
        console.log(`[AI] Article ${articleId} task '${type}' done — ${hasPending ? 'still has pending tasks' : 'no more tasks'}`);
      }

      // Fetch and return the updated article
      const { rows: updatedRows } = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [articleId]
      );

      return NextResponse.json({
        message: allDone && !skippedPublish ? "AI-обработка завершена — статья опубликована" : "AI-обработка завершена успешно",
        article: updatedRows[0],
        queueId,
      });
    } catch (aiError) {
      console.error("AI processing error:", aiError);

      const errorMessage = aiError instanceof Error ? aiError.message : "Неизвестная ошибка AI-обработки";

      // Update article status to 'error'
      await pool.query(
        `UPDATE articles SET status = 'error', "errorMessage" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [errorMessage, articleId]
      );

      // Update queue entry to 'error'
      await pool.query(
        `UPDATE processing_queue SET status = 'error', error = $1, "completedAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`,
        [errorMessage, queueId]
      );

      return NextResponse.json(
        { error: "Ошибка AI-обработки", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in AI processing endpoint:", error);
    return NextResponse.json(
      { error: "Ошибка AI-обработки" },
      { status: 500 }
    );
  }
}

/**
 * Process categorization: AI determines the best space (section) for an article.
 * If no matching space exists, creates a new one.
 */
async function processCategorization(
  article: Record<string, unknown>,
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 15, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const title = (article.title as string) || "";
  const content = (article.content as string) || "";

  // Fetch all available spaces
  const { rows: spaces } = await pool.query(
    `SELECT id, name, slug, description FROM knowledge_spaces ORDER BY name`
  );

  await pool.query(
    `UPDATE processing_queue SET progress = 25, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const spaceList = spaces.map((s: Record<string, unknown>) => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));

  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для точной классификации образовательных материалов по тематическим разделам.

ВАЖНО: Классифицируй статью по ЕЁ РЕАЛЬНОМУ СОДЕРЖАНИЮ, а не по общему домену. Статья о конкретном инструменте должна попасть в раздел этого инструмента, а не в общий раздел.

Доступные разделы:
${JSON.stringify(spaceList, null, 2)}

Правила классификации:
1. Внимательно прочитай содержание статьи и определи ГЛАВНУЮ тему — что конкретно обсуждается
2. Выбери раздел, который ТОЧНО соответствует главной теме статьи
3. НЕ отправляй статью в общий раздел, если есть более конкретный подходящий раздел
4. Если статья о конкретном инструменте (Cursor, Claude Code, MCP и т.д.) — создавай отдельный раздел для этого инструмента
5. Если ни один раздел не подходит — создай новый с точным названием темы

ПРИМЕРЫ правильной классификации:
- Статья "Создание MCP-сервера на TypeScript" → раздел "MCP" или создать "MCP-серверы" (а НЕ "Prompt Engineering")
- Статья "Cursor: управление контекстом" → раздел "Cursor" (а НЕ "AI Разработка")
- Статья "Chain-of-Thought промптинг" → раздел "Промпт-инжиниринг"

Верни ТОЛЬКО валидный JSON с одной из структур:
- {"action": "assign", "spaceId": "existing-space-id", "reason": "почему этот раздел подходит"}
- {"action": "create_space", "spaceName": "Новый раздел", "reason": "почему нужен новый раздел"}`,
    },
    {
      role: "user",
      content: `Название статьи: ${title}\n\nКраткое содержание:\n${content.substring(0, 4000)}`,
    },
  ]);

  await pool.query(
    `UPDATE processing_queue SET progress = 50, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    console.warn("AI categorization: no result returned, skipping");
    return;
  }

  let parsed: Record<string, string>;
  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn(`AI categorization: failed to parse response: ${result.substring(0, 200)}`);
    return;
  }

  let assignedSpaceId: string | null = null;

  if (parsed.action === "assign" && parsed.spaceId) {
    // Verify the space exists
    const { rows: spaceCheck } = await pool.query(
      `SELECT id FROM knowledge_spaces WHERE id = $1`,
      [parsed.spaceId]
    );
    if (spaceCheck.length > 0) {
      assignedSpaceId = parsed.spaceId;
    }
  } else if (parsed.action === "create_space" && parsed.spaceName) {
    // Create new space (with duplicate slug handling)
    const spaceSlug = parsed.spaceName
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60) || `ks-${Date.now()}`;

    // Check if space with this slug already exists
    const { rows: existingSpace } = await pool.query(
      `SELECT id FROM knowledge_spaces WHERE slug = $1`,
      [spaceSlug]
    );

    if (existingSpace.length > 0) {
      assignedSpaceId = existingSpace[0].id;
      console.log(`[AI] Reusing existing space "${parsed.spaceName}" (${assignedSpaceId})`);
    } else {
      const newSpaceId = 'ks_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const { rows: insertedSpace } = await pool.query(
        `INSERT INTO knowledge_spaces (id, name, slug, "order", "isPublished", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, true, NOW(), NOW())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [newSpaceId, parsed.spaceName, spaceSlug]
      );
      assignedSpaceId = insertedSpace[0]?.id || newSpaceId;
    }
  }

  // Assign the space to the article
  if (assignedSpaceId) {
    await pool.query(
      `UPDATE articles SET "spaceId" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [assignedSpaceId, articleId]
    );
  }
}

/**
 * Process metadata: AI generates summary, difficulty, keyConcepts, estimatedTime, tags, keyTopics
 */
async function processMetadata(
  article: Record<string, unknown>,
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 60, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const content = (article.content as string) || "";
  const title = (article.title as string) || "";

  // Fetch existing articles for relative difficulty assessment
  const { rows: existingArticles } = await pool.query(
    `SELECT id, title, difficulty, tags, summary FROM articles WHERE id != $1 AND status IN ('done', 'pending', 'processing') ORDER BY "createdAt" DESC LIMIT 50`,
    [articleId]
  );

  const existingContext = existingArticles.length > 0
    ? `\n\nУже существующие статьи в базе (для определения относительной сложности):\n${existingArticles.map((a: Record<string, unknown>, i: number) =>
        `${i + 1}. [${a.difficulty || "нет"}] "${a.title}" — ${a.summary || "нет описания"}`
      ).join("\n")}`
    : "";

  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для глубокого анализа образовательных статей. Проанализируй статью и верни JSON со следующими полями:

- title: УНИКАЛЬНОЕ название статьи, точно отражающее её содержание. НЕ используй шаблоны "Статья о..." или "Обзор...". Формат: "[Тема]: [Что именно]". ПРИМЕР: "MCP-серверы: создание сервера на TypeScript"
- summary: КОНКРЕТНОЕ описание (2-3 предложения) с фактами из статьи. ЗАПРЕЩЕНО начинать с "Статья посвящена...", "В статье рассматривается...", "Данный материал...". Начинай с конкретного факта или идеи. ПРИМЕР: "MCP-сервер позволяет AI-инструментам получать доступ к внешним данным через стандартизированный протокол. Подробно разбирается создание сервера на TypeScript с валидацией Zod."
- difficulty: уровень сложности — сравнивай с уже существующими статьями. Если в базе есть статьи уровня "easy", а эта сложнее — ставь "medium". Если в базе всё "medium", а эта базовая — ставь "easy". ("easy", "medium" или "hard")
- keyConcepts: массив ключевых концепций (строки, до 10 штук) — конкретные термины и идеи из статьи
- estimatedTime: предполагаемое время изучения (например "30 мин", "2 часа")
- tags: массив УНИКАЛЬНЫХ тегов (строки, до 8 штук) — конкретные технологии, инструменты, методы из статьи
- keyTopics: массив ключевых тем (строки, до 5 штук)

Верни ТОЛЬКО валидный JSON, без markdown-блоков и пояснений.`,
    },
    {
      role: "user",
      content: `Название: ${title}\n\nСодержание:\n${content.substring(0, 8000)}${existingContext}`,
    },
  ]);

  await pool.query(
    `UPDATE processing_queue SET progress = 80, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("AI не вернул результат для метаданных");
  }

  // Parse the AI response — handle possible markdown code blocks
  let parsed: Record<string, unknown>;
  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Не удалось разобрать ответ AI: ${result.substring(0, 200)}`);
  }

  // Update article with AI-generated metadata (including title if AI generated a better one)
  await pool.query(
    `UPDATE articles SET
      title = COALESCE($1, title),
      summary = COALESCE($2, summary),
      difficulty = $3,
      "keyConcepts" = $4,
      "estimatedTime" = $5,
      tags = $6,
      "keyTopics" = $7,
      "aiGenerated" = true,
      "updatedAt" = NOW()
    WHERE id = $8`,
    [
      (parsed.title as string) || null,
      (parsed.summary as string) || null,
      (parsed.difficulty as string) || null,
      parsed.keyConcepts ? JSON.stringify(parsed.keyConcepts) : null,
      (parsed.estimatedTime as string) || null,
      parsed.tags ? JSON.stringify(parsed.tags) : null,
      parsed.keyTopics ? JSON.stringify(parsed.keyTopics) : null,
      articleId,
    ]
  );

  // Update queue result
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify(parsed), queueId]
  );
}

/**
 * Process glossary: AI extracts glossary terms from article content
 */
async function processGlossary(
  article: Record<string, unknown>,
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 20, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const content = (article.content as string) || "";
  const title = (article.title as string) || "";

  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для извлечения глоссарных терминов из образовательных статей. 
Проанализируй статью и верни JSON-массив терминов. Каждый термин — объект с полями:
- term: название термина
- definition: полное определение (2-3 предложения)
- shortDefinition: краткое определение (до 15 слов)
- category: категория ("AI", "Tools", "1C", "General")

Верни ТОЛЬКО валидный JSON-массив, без markdown-блоков и пояснений. Если терминов нет — верни пустой массив [].`,
    },
    {
      role: "user",
      content: `Название: ${title}\n\nСодержание:\n${content.substring(0, 8000)}`,
    },
  ]);

  await pool.query(
    `UPDATE processing_queue SET progress = 60, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("AI не вернул результат для глоссария");
  }

  let terms: Array<Record<string, unknown>>;
  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    terms = JSON.parse(cleaned);
  } catch {
    throw new Error(`Не удалось разобрать ответ AI для глоссария: ${result.substring(0, 200)}`);
  }

  // Insert glossary terms
  const createdTerms: string[] = [];
  for (const term of terms) {
    if (!term.term || !term.definition) continue;

    // Check if term already exists
    const existing = await pool.query(
      `SELECT id FROM glossary_terms WHERE term = $1`,
      [term.term as string]
    );

    if (existing.rows.length > 0) {
      // Update existing term with AI-generated data
      await pool.query(
        `UPDATE glossary_terms SET definition = $1, "shortDefinition" = COALESCE($2, "shortDefinition"), category = COALESCE($3, category), "sourceArticleId" = $4, "aiGenerated" = true, "updatedAt" = NOW()
         WHERE term = $5`,
        [
          term.definition as string,
          (term.shortDefinition as string) || null,
          (term.category as string) || null,
          articleId,
          term.term as string,
        ]
      );
      createdTerms.push(term.term as string);
    } else {
      const termId = genId("gt_");
      await pool.query(
        `INSERT INTO glossary_terms (id, term, definition, "shortDefinition", category, "sourceArticleId", "aiGenerated", "order", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, true, 0, NOW(), NOW())`,
        [
          termId,
          term.term as string,
          term.definition as string,
          (term.shortDefinition as string) || null,
          (term.category as string) || null,
          articleId,
        ]
      );
      createdTerms.push(term.term as string);
    }
  }

  // Update queue result
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify({ termsExtracted: createdTerms.length, terms: createdTerms }), queueId]
  );
}

/**
 * Process graph: AI generates prerequisites and nextTopics relationships across all articles
 */
async function processGraph(
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 10, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // Fetch all articles for graph building
  const { rows: allArticles } = await pool.query(
    `SELECT id, title, summary, tags, "keyTopics", difficulty FROM articles WHERE status IN ('done', 'pending', 'processing')`
  );

  await pool.query(
    `UPDATE processing_queue SET progress = 30, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // Build a compact representation for the AI
  const articlesInfo = allArticles.map((a: Record<string, unknown>) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    tags: a.tags ? JSON.parse(a.tags as string) : [],
    keyTopics: a.keyTopics ? JSON.parse(a.keyTopics as string) : [],
    difficulty: a.difficulty,
  }));

  const targetArticle = allArticles.find((a: Record<string, unknown>) => a.id === articleId);
  if (!targetArticle) {
    throw new Error("Целевая статья не найдена для построения графа");
  }

  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для анализа связей между образовательными статьями и построения логической последовательности обучения.

На основе списка всех статей определи для целевой статьи:
- prerequisites: массив ID статей, которые нужно изучить ПЕРЕД этой (до 5 штук) — какие знания нужны как база
- nextTopics: массив ID статей, которые стоит изучить ПОСЛЕ этой (до 5 штук) — куда двигаться дальше
- rank: топологический ранг (0 = вводная, чем выше — тем продвинутее)

ПРАВИЛА РАНЖИРОВАНИЯ:
- rank = 0: базовая/вводная статья, не требует предварительных знаний
- rank = 1: требует общих знаний предметной области
- rank = 2: требует прохождения 1-2 конкретных статей из prerequisites
- rank = 3+: продвинутая, требует нескольких пройденных тем

Учитывай:
- Логическую последовательность тем (от простого к сложному)
- Тематические связи (статьи об одном инструменте идут вместе)
- Реальную сложность материала (не только заявленную difficulty)

Верни ТОЛЬКО валидный JSON: {"prerequisites": ["id1", ...], "nextTopics": ["id2", ...], "rank": 0}`,
    },
    {
      role: "user",
      content: `Целевая статья: ${JSON.stringify({ id: targetArticle.id, title: targetArticle.title, summary: targetArticle.summary, difficulty: targetArticle.difficulty })}

Все статьи базы знаний:
${JSON.stringify(articlesInfo, null, 2)}`,
    },
  ]);

  await pool.query(
    `UPDATE processing_queue SET progress = 70, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("AI не вернул результат для графа связей");
  }

  let parsed: { prerequisites?: string[]; nextTopics?: string[]; rank?: number };
  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Не удалось разобрать ответ AI для графа: ${result.substring(0, 200)}`);
  }

  // Validate that the referenced article IDs actually exist
  const allIds = new Set(allArticles.map((a: Record<string, unknown>) => a.id as string));
  const validPrerequisites = (parsed.prerequisites || []).filter((id: string) => allIds.has(id));
  const validNextTopics = (parsed.nextTopics || []).filter((id: string) => allIds.has(id));
  const rank = typeof parsed.rank === "number" ? parsed.rank : null;

  // Update article with graph data + rank
  await pool.query(
    `UPDATE articles SET
      prerequisites = $1,
      "nextTopics" = $2,
      "updatedAt" = NOW()
    WHERE id = $3`,
    [
      JSON.stringify(validPrerequisites),
      JSON.stringify(validNextTopics),
      articleId,
    ]
  );

  // Update queue result
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify({ prerequisites: validPrerequisites, nextTopics: validNextTopics, rank }), queueId]
  );
}

/**
 * Process content extraction: Download PDF, extract text, convert to Markdown article.
 * Then use AI to structure the raw text into a well-formatted educational article.
 */
async function processContentExtraction(
  article: Record<string, unknown>,
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 10, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  let pdfUrl = (article.pdfUrl as string) || "";
  const title = (article.title as string) || "";
  let pdfFileKey: string | null = null;

  // If pdfUrl is not set on the article, check the media table for PDF files
  if (!pdfUrl) {
    const { rows: mediaRows } = await pool.query(
      `SELECT url, "fileKey" FROM media WHERE "articleId" = $1 AND "mimeType" LIKE 'application/pdf%' ORDER BY "createdAt" DESC LIMIT 1`,
      [articleId]
    );
    if (mediaRows.length > 0 && mediaRows[0].url) {
      pdfUrl = mediaRows[0].url;
      pdfFileKey = mediaRows[0].fileKey || null;
      console.log(`[Content] Using PDF from media table: ${pdfUrl.substring(0, 80)}...`);
    }
  }

  if (!pdfUrl) {
    // Mark as error so the user can retry after fixing storage configuration
    // (Previously was marked as "done" which prevented retries)
    console.warn(`[Content] Article ${articleId} has no PDF URL — cannot extract content`);
    throw new Error("PDF не загружен в хранилище — нет URL для скачивания. Проверьте настройки хранилища (S3 или Vercel Blob).");
  }

  // Download the PDF — for S3 private buckets, use signed URL or streamObject
  let pdfBuffer: Buffer;
  if (storageProvider instanceof S3StorageProvider) {
    // Use S3 streamObject to bypass signed URL issues with Selectel
    const s3 = storageProvider as S3StorageProvider;
    const key = pdfFileKey || s3.extractKeyFromUrl(pdfUrl);
    if (key) {
      console.log(`[Content] Streaming PDF from S3 key: ${key}`);
      try {
        // Resolve key first (handles encoding issues)
        const resolved = await s3.resolveKey(key);
        const actualKey = resolved?.key || key;
        const stream = await s3.streamObject(actualKey);

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of stream.body) {
          chunks.push(Buffer.from(chunk));
        }
        pdfBuffer = Buffer.concat(chunks);
        console.log(`[Content] PDF streamed from S3, size: ${pdfBuffer.length} bytes`);
      } catch (streamErr) {
        // Fallback: try with signed URL
        console.warn(`[Content] S3 stream failed, trying signed URL:`, streamErr);
        const resolvedKey = (await s3.resolveKey(key))?.key || key;
        const signedUrl = await s3.getSignedUrl(resolvedKey, 600);
        console.log(`[Content] Downloading PDF via signed URL: ${signedUrl.substring(0, 80)}...`);
        const pdfResponse = await fetch(signedUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Не удалось скачать PDF (${pdfResponse.status}): ${pdfUrl.substring(0, 100)}`);
        }
        pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      }
    } else {
      // No key extracted, try direct URL
      console.log(`[Content] No S3 key extracted, downloading PDF from: ${pdfUrl.substring(0, 80)}...`);
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Не удалось скачать PDF (${pdfResponse.status}): ${pdfUrl.substring(0, 100)}`);
      }
      pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    }
  } else {
    // Non-S3 storage (Vercel Blob, Memory) — direct URL access
    console.log(`[Content] Downloading PDF from: ${pdfUrl.substring(0, 80)}...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Не удалось скачать PDF (${pdfResponse.status}): ${pdfUrl.substring(0, 100)}`);
    }
    pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
  }

  console.log(`[Content] PDF downloaded, size: ${pdfBuffer.length} bytes`);

  await pool.query(
    `UPDATE processing_queue SET progress = 30, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // Extract text from PDF using pdf-parse
  // NOTE: Must import from 'pdf-parse/lib/pdf-parse.js' directly to avoid
  // the broken test runner in index.js that checks `module.parent` (broken in ESM)
  let rawText: string;
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const pdfData = await pdfParse(pdfBuffer);
    rawText = pdfData.text || "";
    console.log(`[Content] Extracted ${rawText.length} chars from PDF, ${pdfData.numpages} pages`);
  } catch (pdfErr) {
    throw new Error(`Не удалось извлечь текст из PDF: ${pdfErr instanceof Error ? pdfErr.message : "неизвестная ошибка"}`);
  }

  if (rawText.trim().length < 20) {
    throw new Error("PDF не содержит извлекаемого текста (возможно сканированный документ)");
  }

  await pool.query(
    `UPDATE processing_queue SET progress = 50, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // Use AI to convert raw PDF text into a well-structured Markdown article
  // Also generate a unique title and summary based on the ACTUAL content
  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для глубокого анализа и структурирования образовательных материалов.

Твоя задача — проанализировать сырой текст из PDF и:
1. ПОНЯТЬ о чём этот материал — какая главная тема, какие концепции обсуждаются, для кого он предназначен
2. Создать УНИКАЛЬНОЕ название, которое точно отражает содержание (НЕ используй шаблоны типа "Статья о..." или "Обзор...")
3. Написать УНИКАЛЬНОЕ краткое описание (summary) — конкретные факты и идеи, а не общие фразы
4. Структурировать весь текст в качественную Markdown-статью

Правила для названия:
- Должно быть конкретным и отражать УНИКАЛЬНОЕ содержание материала
- Формат: "[Тема]: [Что именно рассматривается]" или просто точное название темы
- ПРИМЕРЫ хороших названий: "MCP-серверы: создание собственного сервера на TypeScript", "Cursor: управление контекстом и Custom Actions", "Промпт-инжиниринг: техника Chain-of-Thought"
- ПРИМЕРЫ плохих названий: "Статья о MCP", "Prompt Engineering" (слишком общее), "Лекция 5"

Правила для summary:
- Начинай с КОНКРЕТНОГО факта или идеи из материала, а не с "Статья посвящена..." или "В статье рассматривается..."
- ПРИМЕРЫ хороших summary: "MCP-сервер позволяет инструментаи AI получать доступ к внешним данным. Рассматривается создание сервера на TypeScript с валидацией через Zod и тестированием через MCP Inspector."
- ПРИМЕРЫ плохих summary: "Статья посвящена разработке MCP-серверов и рассматривает их преимущества."

Правила для Markdown-контента:
1. Сохрани ВСЮ существенную информацию — не пропускай важные детали
2. Структурируй текст заголовками (##, ###), списками, жирным текстом
3. Добавь введение (2-3 абзаца) — опиши ЧТО конкретно будет изучено и ЗАЧЕМ это нужно
4. Если есть код — оформи в блоки \`\`\`
5. Убери артефакты PDF: лишние пробелы, переносы строк внутри слов, повторяющиеся заголовки страниц, номера страниц
6. Сохрани терминологию и язык оригинала
7. НЕ добавляй несуществующую информацию — только переработай то, что есть в тексте

Верни ТОЛЬКО валидный JSON:
{
  "title": "Уникальное название статьи",
  "summary": "Конкретное описание с фактами из материала (2-3 предложения)",
  "content": "Полный Markdown-контент статьи (начиная с ##, без заголовка первого уровня)"
}`,
    },
    {
      role: "user",
      content: `Исходное название файла (может быть неточным): ${title}\n\nСырой текст из PDF:\n${rawText.substring(0, 16000)}`,
    },
  ], { temperature: 0.3, max_tokens: 8192 });

  await pool.query(
    `UPDATE processing_queue SET progress = 80, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const aiResult = completion.choices[0]?.message?.content;
  if (!aiResult) {
    throw new Error("AI не вернул результат для конвертации контента");
  }

  // Parse AI response — extract title, summary, and content
  let parsedContent: { title?: string; summary?: string; content?: string };
  try {
    const cleaned = aiResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsedContent = JSON.parse(cleaned);
  } catch {
    // Fallback: if AI didn't return valid JSON, use the raw result as content
    console.warn(`[Content] AI didn't return valid JSON, using raw result as content`);
    const finalContent = `# ${title}\n\n${aiResult}`;
    await pool.query(
      `UPDATE articles SET content = $1, "updatedAt" = NOW() WHERE id = $2`,
      [finalContent, articleId]
    );
    await pool.query(
      `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify({ extractedChars: rawText.length, fallback: true }), queueId]
    );
    return;
  }

  const aiTitle = parsedContent.title || title;
  const aiSummary = parsedContent.summary || null;
  const aiMarkdown = parsedContent.content || aiResult;

  // Build final content: title heading + AI-structured content
  const finalContent = `# ${aiTitle}\n\n${aiMarkdown}`;

  // Update article with extracted content + AI-generated title and summary
  await pool.query(
    `UPDATE articles SET content = $1, title = COALESCE($2, title), summary = COALESCE($3, summary), "updatedAt" = NOW() WHERE id = $4`,
    [finalContent, aiTitle, aiSummary, articleId]
  );

  console.log(`[Content] Article ${articleId} updated: title="${aiTitle}", ${finalContent.length} chars content`);

  // Update queue result
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify({ extractedChars: rawText.length, finalChars: finalContent.length, aiTitle, aiSummary: aiSummary?.substring(0, 100) }), queueId]
  );
}

// ═══════════════════════════════════════════════════════════════════
// COURSE CONTENT PROCESSOR (Sprint 7 — NotebookLM pipeline)
// ═══════════════════════════════════════════════════════════════════

interface CourseAIResponse {
  summary: string;
  difficulty: "easy" | "medium" | "hard";
  keyConcepts: string[];
  estimatedTime: string;
  tags: string[];
  keyTopics: string[];
  timecodes: Array<{
    time: string;        // "00:00" — таймкод в формате MM:SS или HH:MM:SS
    title: string;       // Краткое название фрагмента
    summary: string;     // 1-2 предложения о чём этот фрагмент
  }>;
  quiz: Array<{
    question: string;
    options: string[];   // 4 варианта ответа
    correctIndex: number; // Индекс правильного ответа (0-3)
    explanation: string;  // Объяснение почему этот ответ правильный
  }>;
  practical_task: {
    title: string;
    description: string;  // Подробное описание задания
    hint: string;         // Подсказка (не раскрывает решение полностью)
    solution: string;     // Полное решение (раскрывается после попытки)
    difficulty: "easy" | "medium" | "hard";
  };
  prerequisites: string[]; // Массив ID статей-пререквизитов (из соседних статей в space)
  rank: number;           // Топологический ранг (0 = базовый, чем выше — тем продвинутее)
}

/**
 * Process course content: AI analyzes NotebookLM transcript and generates
 * interactive lesson components (timecodes, quiz, practical task) + metadata.
 *
 * This is the core of the NotebookLM → Interactive Course pipeline.
 * Input: raw transcript text (typically from NotebookLM or similar tool).
 * Output: structured JSON with timecodes, quiz questions, practical task,
 *         plus standard metadata (summary, difficulty, keyConcepts, etc.)
 */
async function processCourseContent(
  article: Record<string, unknown>,
  articleId: string,
  queueId: string
) {
  await pool.query(
    `UPDATE processing_queue SET progress = 5, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const content = (article.content as string) || "";
  const title = (article.title as string) || "";
  const spaceId = (article.spaceId as string) || null;

  // ─── Step 1: Fetch course context (sibling articles in the same space) ───
  let siblingArticles: Array<{ id: string; title: string; summary: string | null; difficulty: string | null }> = [];
  if (spaceId) {
    const { rows: siblings } = await pool.query(
      `SELECT id, title, summary, difficulty
       FROM articles
       WHERE "spaceId" = $1 AND id != $2 AND status IN ('done', 'pending', 'processing')
       ORDER BY "createdAt" ASC
       LIMIT 30`,
      [spaceId, articleId]
    );
    siblingArticles = siblings;
  }

  await pool.query(
    `UPDATE processing_queue SET progress = 15, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // ─── Step 2: Build context string for the AI ───
  const courseContext = siblingArticles.length > 0
    ? `\n\nКонтекст курса (другие уроки в этом разделе):\n${siblingArticles.map((a, i) =>
        `${i + 1}. [${a.id}] "${a.title}" (${a.difficulty || "нет сложности"}): ${a.summary || "без описания"}`
      ).join("\n")}`
    : "\n\nКонтекст курса: это единственный урок в разделе.";

  // ─── Step 3: Main AI prompt for NotebookLM processing ───
  const systemPrompt = `Ты — AI-ассистент для создания интерактивных образовательных уроков из подробных конспектов (NotebookLM-транскриптов).

Твоя задача — проанализировать конспект урока и создать структурированный интерактивный урок с несколькими компонентами.

ВАЖНО: Конспект может быть очень подробным и длинным — это нормально. Ты должен извлечь из него самое важное и структурировать.

Верни ТОЛЬКО валидный JSON со следующими полями:

{
  "summary": "Краткое описание урока (2-3 предложения, что изучим и зачем)",
  "difficulty": "easy" | "medium" | "hard",
  "keyConcepts": ["концепция 1", "концепция 2", ...],  // до 10 ключевых концепций
  "estimatedTime": "30 мин",  // предполагаемое время изучения
  "tags": ["тег1", "тег2", ...],  // до 8 тегов
  "keyTopics": ["тема1", "тема2", ...],  // до 5 ключевых тем

  "timecodes": [
    {
      "time": "00:00",  // таймкод ММ:СС или ЧЧ:ММ:СС
      "title": "Название фрагмента",
      "summary": "1-2 предложения о чём этот фрагмент"
    }
  ],  // 5-15 таймкодов, разбивающих урок на логические части

  "quiz": [
    {
      "question": "Вопрос по материалу урока",
      "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
      "correctIndex": 0,  // индекс правильного ответа (0-3)
      "explanation": "Объяснение почему этот ответ правильный"
    }
  ],  // 5-10 вопросов с 4 вариантами ответа (ОБЯЗАТЕЛЬНО минимум 5)

  "practical_task": {
    "title": "Название практического задания",
    "description": "Подробное описание задания (что нужно сделать, какие инструменты использовать)",
    "hint": "Подсказка (не раскрывает решение полностью, направляет мысль)",
    "solution": "Полное решение с пошаговым объяснением",
    "difficulty": "easy" | "medium" | "hard"
  },  // Практическое задание для закрепления материала

  "prerequisites": ["id1", "id2"],  // ID статей из контекста курса, которые нужно пройти ДО этого урока
  "rank": 0  // Топологический ранг: 0 = базовый (для начинающих), чем выше — тем продвинутее
}

ПРАВИЛА ДЛЯ ТАЙМКОДОВ:
- Разбей конспект на 5-15 логических фрагментов
- Таймкоды указывай в формате ММ:СС (если урок < 1 часа) или ЧЧ:ММ:СС (если > 1 часа)
- Начинай с 00:00
- Каждый фрагмент — это отдельная тема/идея/шаг
- Title — краткое название (до 50 символов), Summary — 1-2 предложения

ПРАВИЛА ДЛЯ КВИЗА (КРИТИЧЕСКИ ВАЖНО):
- ОБЯЗАТЕЛЬНО минимум 5 вопросов (лучше 7-10 для объёмных уроков)
- Вопросы должны проверять ПОНИМАНИЕ, а не запоминание
- 4 варианта ответа, один правильный
- Explanation — 1-2 предложения, объясняющие правильный ответ
- Избегайте тривиальных вопросов («какой цвет кнопки»)
- НЕ возвращай пустой массив quiz — квиз ОБЯЗАТЕЛЕН для каждого урока
- Если материала мало — создай минимум 5 вопросов, пусть простых

ПРАВИЛА ДЛЯ ПРАКТИЧЕСКОГО ЗАДАНИЯ (КРИТИЧЕСКИ ВАЖНО):
- ОБЯЗАТЕЛЬНО для каждого урока — НЕ возвращай null для practical_task
- Задание должно быть выполнимым на основе материала урока
- Description — чёткое описание что нужно сделать
- Hint — направление мысли без прямого ответа
- Solution — пошаговое решение с объяснением каждого шага
- Difficulty должна соответствовать сложности урока
- Даже для простых уроков создавай практическое задание

ПРАВИЛА ДЛЯ РАНЖИРОВАНИЯ:
- rank = 0: вводный урок, не требует предварительных знаний
- rank = 1: базовый, требует общих знаний предмета
- rank = 2: средний, требует прохождения 1-2 базовых уроков
- rank = 3+: продвинутый, требует нескольких пройденных тем
- Используй prerequisites для ссылок на конкретные уроки из контекста курса
- Если контекст курса пуст, ставь rank = 0 и пустой prerequisites

Верни ТОЛЬКО валидный JSON, без markdown-блоков и пояснений.`;

  const userPrompt = `Название урока: ${title}

Конспект (NotebookLM-транскрипт):
${content.substring(0, 16000)}
${courseContext}`;

  console.log(`[Course] Processing article ${articleId}: ${content.length} chars content, ${siblingArticles.length} siblings`);

  const completion = await createChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { temperature: 0.2, max_tokens: 8192 });

  await pool.query(
    `UPDATE processing_queue SET progress = 60, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("AI не вернул результат для обработки курса");
  }

  // ─── Step 4: Parse AI response ───
  let parsed: CourseAIResponse;
  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Не удалось разобрать ответ AI для курса: ${result.substring(0, 300)}`);
  }

  await pool.query(
    `UPDATE processing_queue SET progress = 75, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // ─── Step 5: Validate prerequisites (only keep IDs that exist) ───
  const validSiblingIds = new Set(siblingArticles.map((a) => a.id));
  const validPrerequisites = (parsed.prerequisites || []).filter((id: string) => validSiblingIds.has(id));

  // ─── Step 6: Sanitize and validate quiz data ───
  // Quiz is MANDATORY — minimum 5 questions required for a valid lesson
  let validQuiz = (parsed.quiz || [])
    .filter((q) =>
      q.question &&
      Array.isArray(q.options) && q.options.length >= 2 &&
      typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < q.options.length &&
      q.explanation
    )
    .slice(0, 10); // Max 10 questions

  // Auto-retry quiz generation once if fewer than 5 valid questions
  if (validQuiz.length < 5) {
    console.warn(`[Course] Article ${articleId}: only ${validQuiz.length} quiz questions (minimum 5). Retrying quiz generation...`);

    try {
      const retryQuizPrompt = `Ты — AI-ассистент для создания тестовых вопросов по образовательным урокам.

КРИТИЧЕСКИ ВАЖНО: Создай РОВНО 5 или больше вопросов. Это обязательное требование — возвращай минимум 5 вопросов.

Верни ТОЛЬКО валидный JSON-массив вопросов в формате:
[
  {
    "question": "Вопрос по материалу урока",
    "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
    "correctIndex": 0,
    "explanation": "Объяснение почему этот ответ правильный"
  }
]

ПРАВИЛА:
- ОБЯЗАТЕЛЬНО минимум 5 вопросов (лучше 7-10)
- 4 варианта ответа, один правильный
- Вопросы должны проверять ПОНИМАНИЕ, а не запоминание
- Explanation — 1-2 предложения

Урок: ${title}

Конспект:
${content.substring(0, 12000)}`;

      const retryCompletion = await createChatCompletion([
        { role: "system", content: retryQuizPrompt },
        { role: "user", content: "Создай минимум 5 тестовых вопросов по этому уроку. Верни ТОЛЬКО JSON-массив." },
      ], { temperature: 0.3, max_tokens: 4096 });

      const retryResult = retryCompletion.choices[0]?.message?.content;
      if (retryResult) {
        const retryCleaned = retryResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const retryParsed = JSON.parse(retryCleaned);
        const retryQuiz = (Array.isArray(retryParsed) ? retryParsed : retryParsed.quiz || [])
          .filter((q: { question?: string; options?: unknown[]; correctIndex?: number; explanation?: string }) =>
            q.question &&
            Array.isArray(q.options) && q.options.length >= 2 &&
            typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < q.options.length &&
            q.explanation
          )
          .slice(0, 10);

        if (retryQuiz.length > validQuiz.length) {
          console.log(`[Course] Article ${articleId}: retry produced ${retryQuiz.length} quiz questions (was ${validQuiz.length})`);
          validQuiz = retryQuiz;
        }
      }
    } catch (retryError) {
      console.warn(`[Course] Article ${articleId}: quiz retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
    }

    if (validQuiz.length < 5) {
      console.warn(`[Course] Article ${articleId}: still only ${validQuiz.length} quiz questions after retry. Accepting what we have.`);
    }
  }

  // ─── Step 7: Sanitize practical task ───
  const validPracticalTask = parsed.practical_task?.title && parsed.practical_task?.description
    ? {
        title: parsed.practical_task.title,
        description: parsed.practical_task.description,
        hint: parsed.practical_task.hint || "",
        solution: parsed.practical_task.solution || "",
        difficulty: ["easy", "medium", "hard"].includes(parsed.practical_task.difficulty)
          ? parsed.practical_task.difficulty
          : (parsed.difficulty || "medium"),
      }
    : null;

  // ─── Step 8: Sanitize timecodes ───
  const validTimecodes = (parsed.timecodes || [])
    .filter((tc) => tc.time && tc.title)
    .map((tc) => ({
      time: tc.time,
      title: tc.title,
      summary: tc.summary || "",
    }))
    .slice(0, 30);

  // ─── Step 9: Save everything to the article ───
  await pool.query(
    `UPDATE articles SET
      summary = COALESCE($1, summary),
      difficulty = COALESCE($2, difficulty),
      "keyConcepts" = COALESCE($3, "keyConcepts"),
      "estimatedTime" = COALESCE($4, "estimatedTime"),
      tags = COALESCE($5, tags),
      "keyTopics" = COALESCE($6, "keyTopics"),
      quiz = $7,
      practical_task = $8,
      timecodes = $9,
      prerequisites = COALESCE($10, prerequisites),
      "aiGenerated" = true,
      "updatedAt" = NOW()
    WHERE id = $11`,
    [
      parsed.summary || null,
      parsed.difficulty || null,
      parsed.keyConcepts ? JSON.stringify(parsed.keyConcepts) : null,
      parsed.estimatedTime || null,
      parsed.tags ? JSON.stringify(parsed.tags) : null,
      parsed.keyTopics ? JSON.stringify(parsed.keyTopics) : null,
      validQuiz.length > 0 ? JSON.stringify(validQuiz) : null,
      validPracticalTask ? JSON.stringify(validPracticalTask) : null,
      validTimecodes.length > 0 ? JSON.stringify(validTimecodes) : null,
      validPrerequisites.length > 0 ? JSON.stringify(validPrerequisites) : null,
      articleId,
    ]
  );

  console.log(`[Course] Article ${articleId} processed: ${validQuiz.length} quiz questions, ${validTimecodes.length} timecodes, practical: ${!!validPracticalTask}, prerequisites: ${validPrerequisites.length}`);

  await pool.query(
    `UPDATE processing_queue SET progress = 90, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  // ─── Step 10: Update queue result ───
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 95, "updatedAt" = NOW() WHERE id = $2`,
    [
      JSON.stringify({
        quizCount: validQuiz.length,
        timecodesCount: validTimecodes.length,
        hasPracticalTask: !!validPracticalTask,
        prerequisitesCount: validPrerequisites.length,
        difficulty: parsed.difficulty,
        rank: parsed.rank,
      }),
      queueId,
    ]
  );
}
