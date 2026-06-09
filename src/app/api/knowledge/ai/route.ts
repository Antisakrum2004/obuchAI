import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";

// POST /api/knowledge/ai — Execute AI processing for an article (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { articleId, type } = body as { articleId?: string; type?: string };

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId обязателен" },
        { status: 400 }
      );
    }

    const validTypes = ["content", "metadata", "glossary", "graph", "categorize"];
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
      `SELECT id, title, content, summary, tags, "keyTopics", "spaceId", "pdfUrl", "pptxUrl", "sourceUrl", "sourceType" FROM articles WHERE id = $1`,
      [articleId]
    );

    if (articleRows.length === 0) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    const article = articleRows[0];

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
        await processContentExtraction(article, articleId, queueId);
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

      // Auto-publish: only if ALL queue items for this article are done
      // (no pending/processing items left) AND content is not a placeholder
      const { rows: remainingItems } = await pool.query(
        `SELECT status FROM processing_queue WHERE "articleId" = $1`,
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
      content: `Ты — AI-ассистент для классификации образовательных материалов. 
На основе названия и содержания статьи, определи наиболее подходящий раздел.

Доступные разделы:
${JSON.stringify(spaceList, null, 2)}

Правила:
1. Если есть подходящий раздел — верни его ID в поле "spaceId"
2. Если нет подходящего раздела — верни "create_space" с названием нового раздела

Верни ТОЛЬКО валидный JSON с одной из структур:
- {"action": "assign", "spaceId": "existing-space-id"}
- {"action": "create_space", "spaceName": "Новый раздел"}`,
    },
    {
      role: "user",
      content: `Название статьи: ${title}\n\nСодержание:\n${content.substring(0, 4000)}`,
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

  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для анализа образовательных статей. Проанализируй статью и верни JSON со следующими полями:
- summary: краткое описание статьи (1-2 предложения)
- difficulty: уровень сложности ("easy", "medium" или "hard")
- keyConcepts: массив ключевых концепций (строки, до 10 штук)
- estimatedTime: предполагаемое время изучения (например "30 мин", "2 часа")
- tags: массив тегов (строки, до 8 штук)
- keyTopics: массив ключевых тем (строки, до 5 штук)

Верни ТОЛЬКО валидный JSON, без markdown-блоков и пояснений.`,
    },
    {
      role: "user",
      content: `Название: ${title}\n\nСодержание:\n${content.substring(0, 8000)}`,
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

  // Update article with AI-generated metadata
  await pool.query(
    `UPDATE articles SET
      summary = COALESCE($1, summary),
      difficulty = $2,
      "keyConcepts" = $3,
      "estimatedTime" = $4,
      tags = $5,
      "keyTopics" = $6,
      "aiGenerated" = true,
      "updatedAt" = NOW()
    WHERE id = $7`,
    [
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
      content: `Ты — AI-ассистент для анализа связей между образовательными статьями. 
На основе списка статей определи для целевой статьи:
- prerequisites: массив ID статей, которые нужно изучить перед этой (до 5 штук)
- nextTopics: массив ID статей, которые стоит изучить после этой (до 5 штук)

Учитывай логическую последовательность тем, сложность и тематические связи.
Верни ТОЛЬКО валидный JSON с полями prerequisites и nextTopics, без markdown-блоков и пояснений.`,
    },
    {
      role: "user",
      content: `Целевая статья: ${JSON.stringify({ id: targetArticle.id, title: targetArticle.title, summary: targetArticle.summary })}

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

  let parsed: { prerequisites?: string[]; nextTopics?: string[] };
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

  // Update article with graph data
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
    [JSON.stringify({ prerequisites: validPrerequisites, nextTopics: validNextTopics }), queueId]
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

  // If pdfUrl is not set on the article, check the media table for PDF files
  if (!pdfUrl) {
    const { rows: mediaRows } = await pool.query(
      `SELECT url FROM media WHERE "articleId" = $1 AND "mimeType" LIKE 'application/pdf%' ORDER BY "createdAt" DESC LIMIT 1`,
      [articleId]
    );
    if (mediaRows.length > 0 && mediaRows[0].url) {
      pdfUrl = mediaRows[0].url;
      console.log(`[Content] Using PDF from media table: ${pdfUrl.substring(0, 80)}...`);
    }
  }

  if (!pdfUrl) {
    throw new Error("У статьи нет прикреплённого PDF для извлечения контента");
  }

  // Download the PDF
  console.log(`[Content] Downloading PDF from: ${pdfUrl.substring(0, 80)}...`);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Не удалось скачать PDF (${pdfResponse.status}): ${pdfUrl.substring(0, 100)}`);
  }

  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
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
  const completion = await createChatCompletion([
    {
      role: "system",
      content: `Ты — AI-ассистент для конвертации сырого текста из PDF в качественную Markdown-статью.

Правила:
1. Сохрани ВСЮ существенную информацию из исходного текста — не пропускай важные детали
2. Структурируй текст с помощью заголовков (##, ###), списков, жирного текста
3. Добавь введение (1-2 абзаца после заголовка)
4. Если есть код — оформи в блоки \`\`\`
5. Убери артефакты PDF: лишние пробелы, переносы строк внутри слов, повторяющиеся заголовки страниц, номера страниц
6. Сохрани терминологию и язык оригинала
7. НЕ добавляй несуществующую информацию — только переработай то, что есть в тексте
8. Верни ТОЛЬКО Markdown-контент, без пояснений и мета-комментариев`,
    },
    {
      role: "user",
      content: `Название статьи: ${title}\n\nСырой текст из PDF:\n${rawText.substring(0, 16000)}`,
    },
  ], { temperature: 0.2, max_tokens: 8192 });

  await pool.query(
    `UPDATE processing_queue SET progress = 80, "updatedAt" = NOW() WHERE id = $1`,
    [queueId]
  );

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("AI не вернул результат для конвертации контента");
  }

  // Build final content: title heading + AI-structured content
  const finalContent = `# ${title}\n\n${result}`;

  // Update article with extracted content
  await pool.query(
    `UPDATE articles SET content = $1, "updatedAt" = NOW() WHERE id = $2`,
    [finalContent, articleId]
  );

  console.log(`[Content] Article ${articleId} updated with ${finalContent.length} chars of content`);

  // Update queue result
  await pool.query(
    `UPDATE processing_queue SET result = $1, progress = 90, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify({ extractedChars: rawText.length, finalChars: finalContent.length, pages: 0 }), queueId]
  );
}
