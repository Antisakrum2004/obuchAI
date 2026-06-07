import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import ZAI from "z-ai-web-dev-sdk";

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

    const validTypes = ["metadata", "glossary", "graph"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type обязателен и должен быть одним из: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch the article
    const { rows: articleRows } = await pool.query(
      `SELECT id, title, content, summary, tags, "keyTopics" FROM articles WHERE id = $1`,
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
      metadata: "ai_metadata",
      glossary: "glossary_extract",
      graph: "graph_build",
    };
    const queueType = queueTypeMap[type];

    // Find existing pending/processing queue entry, or create one
    let { rows: queueRows } = await pool.query(
      `SELECT id FROM processing_queue WHERE "articleId" = $1 AND type = $2 AND status IN ('pending', 'processing') ORDER BY "createdAt" DESC LIMIT 1`,
      [articleId, queueType]
    );

    let queueId: string;
    if (queueRows.length > 0) {
      queueId = queueRows[0].id;
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
      const zai = await ZAI.create();

      if (type === "metadata") {
        await processMetadata(zai, article, articleId, queueId);
      } else if (type === "glossary") {
        await processGlossary(zai, article, articleId, queueId);
      } else if (type === "graph") {
        await processGraph(zai, articleId, queueId);
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

      // Fetch and return the updated article
      const { rows: updatedRows } = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [articleId]
      );

      return NextResponse.json({
        message: "AI-обработка завершена успешно",
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
 * Process metadata: AI generates summary, difficulty, keyConcepts, estimatedTime, tags, keyTopics
 */
async function processMetadata(
  zai: ZAI,
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

  const completion = await zai.chat.completions.create({
    messages: [
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
    ],
  });

  await pool.query(
    `UPDATE processing_queue SET progress = 70, "updatedAt" = NOW() WHERE id = $1`,
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
  zai: ZAI,
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

  const completion = await zai.chat.completions.create({
    messages: [
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
    ],
  });

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
  zai: ZAI,
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

  const completion = await zai.chat.completions.create({
    messages: [
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
    ],
  });

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
