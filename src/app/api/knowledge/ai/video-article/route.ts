import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // Full pipeline can take 2-3 minutes

/**
 * POST /api/knowledge/ai/video-article
 *
 * Full pipeline: YouTube URL → AI generates article from video → create article → AI processing chain
 * Uses the same AI provider (OpenRouter/OpenAI) as the rest of the project.
 *
 * Body: { url: string, title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { url, title: customTitle } = body as { url?: string; title?: string };

    if (!url) {
      return NextResponse.json({ error: "URL видео обязателен" }, { status: 400 });
    }

    // Check AI is configured (same provider as rest of project)
    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: "AI API не настроен. Добавьте OPENROUTER_API_KEY в env.", code: "AI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // Extract YouTube video ID
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Не удалось извлечь ID видео из URL. Поддерживаются ссылки YouTube." },
        { status: 400 }
      );
    }

    // Step 1: Use AI to generate article from video URL and metadata
    // AI has knowledge of popular YouTube videos and can generate detailed content
    console.log(`[VideoArticle] Generating article for video ${videoId}...`);

    const completion = await createChatCompletion(
      [
        {
          role: "system",
          content: `Ты — AI-ассистент для создания обучающих статей из видео. Твоя задача — создать подробную статью-конспект на основе видео.

Правила:
1. Создай ПОДРОБНЫЙ конспект (минимум 1500 слов) — как если бы ты посмотрел видео и записал все ключевые моменты
2. Структурируй по разделам с заголовками (## Заголовок)
3. Включи все ключевые концепции, термины, примеры и практические советы
4. Используй Markdown-форматирование (списки, жирный, код и т.д.)
5. Адаптируй содержание для 1C-разработчиков, изучающих AI-инструменты

Верни ТОЛЬКО валидный JSON (без markdown-обёрток):
{
  "title": "Название статьи (адаптированное, информативное)",
  "content": "Полный Markdown-текст статьи...",
  "summary": "Краткое описание (2-3 предложения)",
  "tags": ["тег1", "тег2", "тег3"],
  "keyConcepts": ["концепция1", "концепция2"],
  "glossaryTerms": [
    {"term": "термин", "definition": "подробное определение", "shortDefinition": "кратко", "category": "AI"}
  ]
}`,
        },
        {
          role: "user",
          content: `Создай статью-конспект на основе этого YouTube видео:
URL: ${url}
Video ID: ${videoId}

Если ты знаешь содержание этого видео — создай подробный конспект.
Если не знаешь конкретное видео — создай обучающую статью по теме, которая наиболее вероятна для данного видео, с пометкой что содержание сгенерировано на основе доступной информации.`,
        },
      ],
      { temperature: 0.4, max_tokens: 4096 }
    );

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      return NextResponse.json(
        { error: "AI не вернул результат обработки видео" },
        { status: 500 }
      );
    }

    // Parse AI response — try JSON first, fallback to raw text
    let transcript: Record<string, unknown>;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      transcript = JSON.parse(cleaned);
    } catch {
      // AI didn't return valid JSON — wrap the content
      transcript = {
        title: `Видео-урок: ${videoId}`,
        content: aiResponse,
        summary: aiResponse.substring(0, 300),
        tags: ["видео", "youtube"],
        keyConcepts: [],
        glossaryTerms: [],
      };
    }

    console.log(`[VideoArticle] AI response parsed, title: ${transcript.title}, content length: ${String(transcript.content || "").length}`);

    // Step 2: Determine space via AI (spaceId is NOT NULL in DB)
    // Use AI to categorize the article into a space
    const spaceId = await determineSpace(
      customTitle || (transcript.title as string) || `Видео-урок: ${videoId}`,
      String(transcript.content || "").substring(0, 2000),
      String(transcript.tags ? JSON.stringify(transcript.tags) : "")
    );

    // Step 3: Create the article — PUBLISH IMMEDIATELY since content is already AI-generated
    const articleTitle = customTitle || (transcript.title as string) || `Видео-урок: ${videoId}`;
    const slug = generateSlug(articleTitle) || `video-${Date.now()}`;
    const articleId = genId("art_");

    await pool.query(
      `INSERT INTO articles (
        id, title, slug, content, summary, tags, "keyConcepts",
        "spaceId", "videoUrl", "sourceUrl", "sourceType",
        status, "isPublished", "aiGenerated", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        'published', true, true, NOW(), NOW()
      )`,
      [
        articleId,
        articleTitle,
        slug,
        transcript.content || "Содержимое будет добавлено после обработки",
        transcript.summary || null,
        transcript.tags ? JSON.stringify(transcript.tags) : null,
        transcript.keyConcepts ? JSON.stringify(transcript.keyConcepts) : null,
        spaceId,
        url,
        url,
        "youtube",
      ]
    );

    console.log(`[VideoArticle] Article created: ${articleId}`);

    // Step 3: Create queue entries for AI processing
    const queueTypes = ["ai_metadata", "glossary_extract", "graph_build", "course_draft"];
    for (const type of queueTypes) {
      const qId = genId("pq_");
      await pool.query(
        `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
         VALUES ($1, $2, 'pending', $3, $4, 0, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [qId, type, articleId, JSON.stringify({ articleId, type })]
      );
    }

    // Step 4: Insert glossary terms if AI extracted them
    if (Array.isArray(transcript.glossaryTerms) && transcript.glossaryTerms.length > 0) {
      for (const term of transcript.glossaryTerms as Array<{ term: string; definition: string; shortDefinition?: string; category?: string }>) {
        if (!term.term || !term.definition) continue;
        const termId = genId("gt_");
        const termSlug = generateSlug(term.term) || `term-${Date.now()}`;
        await pool.query(
          `INSERT INTO glossary_terms (id, term, slug, definition, "shortDefinition", category, "articleId", "aiGenerated", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [termId, term.term, termSlug, term.definition, term.shortDefinition || null, term.category || "AI", articleId]
        );
      }
    }

    // Step 5: Fire-and-forget AI processing chain (metadata → glossary → course)
    // Article is already published, so this is supplementary enrichment.
    // Each step updates its queue item status so the UI tracks progress.
    const processChain = async () => {
      try {
        // Metadata: refine space, difficulty, tags
        await processMetadataWithQueue(articleId);
        // Glossary: extract additional terms
        await processGlossaryWithQueue(articleId);
        // Graph: build knowledge graph connections
        await processGraphWithQueue(articleId);
        // Course: create quiz + practice
        await processCourseWithQueue(articleId);
        console.log(`[VideoArticle] AI processing chain complete for ${articleId}`);
      } catch (err) {
        console.error("[VideoArticle] AI processing chain error:", err);
      }
    };
    processChain();

    return NextResponse.json({
      articleId,
      title: articleTitle,
      slug,
      message: "Статья из видео создана и опубликована. AI-обогащение запущено в фоне...",
      published: true,
      transcriptPreview: {
        title: transcript.title,
        summary: String(transcript.summary || "").substring(0, 200),
        contentLength: String(transcript.content || "").length,
        glossaryCount: Array.isArray(transcript.glossaryTerms) ? transcript.glossaryTerms.length : 0,
      },
    });
  } catch (error) {
    console.error("[Video Article] Error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: "Ошибка создания статьи из видео", details: message },
      { status: 500 }
    );
  }
}

// ── Determine Space via AI ──────────────────────────────────────

async function determineSpace(title: string, contentPreview: string, tagsJson: string): Promise<string> {
  try {
    // First try to find existing spaces
    const spacesRes = await pool.query(
      `SELECT id, name FROM knowledge_spaces ORDER BY "order" ASC`
    );
    const existingSpaces = spacesRes.rows as Array<{ id: string; name: string }>;

    if (existingSpaces.length === 0) {
      // No spaces exist — create a default one
      const defaultSpaceId = genId("ks_");
      await pool.query(
        `INSERT INTO knowledge_spaces (id, name, slug, "isPublished", "order", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, 1, NOW(), NOW())`,
        [defaultSpaceId, "Основы AI", "osnovy-ai"]
      );
      console.log(`[VideoArticle] Created default space "Основы AI" (${defaultSpaceId})`);
      return defaultSpaceId;
    }

    // Ask AI which space fits best
    const spaceNames = existingSpaces.map((s) => `"${s.name}"`).join(", ");

    const completion = await createChatCompletion([
      {
        role: "system",
        content: `Определи, в какой раздел лучше всего поместить статью. Доступные разделы: ${spaceNames}. Ответь ТОЛЬКО названием раздела (точно как в списке), без кавычек и пояснений.`,
      },
      {
        role: "user",
        content: `Статья: "${title}"\nТеги: ${tagsJson}\n\n${contentPreview.substring(0, 1500)}`,
      },
    ], { temperature: 0.1 });

    const aiChoice = completion.choices[0]?.message?.content?.trim();
    if (aiChoice) {
      const matched = existingSpaces.find((s) =>
        s.name.toLowerCase() === aiChoice.toLowerCase() ||
        s.name.toLowerCase().includes(aiChoice.toLowerCase()) ||
        aiChoice.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched) {
        console.log(`[VideoArticle] AI chose space: "${matched.name}" (${matched.id})`);
        return matched.id;
      }
    }

    // Fallback: use first space
    const firstSpace = existingSpaces[0];
    console.log(`[VideoArticle] AI space match failed, using first: "${firstSpace.name}" (${firstSpace.id})`);
    return firstSpace.id;
  } catch (err) {
    console.error("[VideoArticle] determineSpace error:", err);
    // Last resort — try to get any space
    const res = await pool.query(`SELECT id FROM knowledge_spaces LIMIT 1`);
    if (res.rows[0]) return res.rows[0].id;
    // Create default
    const id = genId("ks_");
    await pool.query(
      `INSERT INTO knowledge_spaces (id, name, slug, "isPublished", "order", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, 1, NOW(), NOW())`,
      [id, "Основы AI", "osnovy-ai"]
    );
    return id;
  }
}

// ── AI Processing Steps (with queue status tracking) ─────────────

/** Helper: mark a queue item as processing */
async function markQueueProcessing(articleId: string, queueType: string) {
  await pool.query(
    `UPDATE processing_queue SET status = 'processing', "startedAt" = NOW(), progress = 10, "updatedAt" = NOW()
     WHERE "articleId" = $1 AND type = $2 AND status IN ('pending', 'error')`,
    [articleId, queueType]
  );
}

/** Helper: mark a queue item as done */
async function markQueueDone(articleId: string, queueType: string, result?: string) {
  await pool.query(
    `UPDATE processing_queue SET status = 'done', progress = 100, "completedAt" = NOW(), result = $3, "updatedAt" = NOW()
     WHERE "articleId" = $1 AND type = $2 AND status = 'processing'`,
    [articleId, queueType, result || null]
  );
}

/** Helper: mark a queue item as error */
async function markQueueError(articleId: string, queueType: string, error: string) {
  await pool.query(
    `UPDATE processing_queue SET status = 'error', error = $3, "completedAt" = NOW(), "updatedAt" = NOW()
     WHERE "articleId" = $1 AND type = $2 AND status = 'processing'`,
    [articleId, queueType, error]
  );
}

async function processMetadataWithQueue(articleId: string) {
  const queueType = "ai_metadata";
  try {
    await markQueueProcessing(articleId, queueType);

    const articleRes = await pool.query(
      `SELECT title, content, summary FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) {
      await markQueueError(articleId, queueType, "Статья не найдена");
      return;
    }

    const completion = await createChatCompletion([
      {
        role: "system",
        content: `Определи раздел, сложность и теги для обучающей статьи. Доступные разделы: "Промпт-инжиниринг", "AI-агенты", "Дебаггинг с AI", "Workflow автоматизация", "1С + AI", "Основы AI".

Верни ТОЛЬКО JSON: {"spaceName":"Название раздела","difficulty":"easy|medium|hard","tags":["т1","т2"]}`,
      },
      {
        role: "user",
        content: `Статья: "${article.title}"\n\n${(article.content || "").substring(0, 2000)}`,
      },
    ]);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      await markQueueDone(articleId, queueType, "AI returned empty response");
      return;
    }

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      await markQueueDone(articleId, queueType, "AI response was not valid JSON");
      return;
    }

    const spaceName = parsed.spaceName as string;
    const difficulty = parsed.difficulty as string;
    const tags = parsed.tags as string[];

    if (spaceName) {
      // Find or create space
      const existingSpace = await pool.query(
        `SELECT id FROM knowledge_spaces WHERE name ILIKE $1 LIMIT 1`,
        [spaceName]
      );
      let spaceId: string;
      if (existingSpace.rows[0]) {
        spaceId = existingSpace.rows[0].id;
      } else {
        spaceId = genId("ks_");
        const spaceSlug = generateSlug(spaceName) || `space-${Date.now()}`;
        await pool.query(
          `INSERT INTO knowledge_spaces (id, name, slug, "isPublished", "order", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, true, 999, NOW(), NOW())`,
          [spaceId, spaceName, spaceSlug]
        );
        console.log(`[VideoArticle] Created new space: "${spaceName}" (${spaceId})`);
      }

      await pool.query(
        `UPDATE articles SET "spaceId" = $1, difficulty = $2, tags = $3, "updatedAt" = NOW() WHERE id = $4`,
        [spaceId, difficulty || null, tags ? JSON.stringify(tags) : null, articleId]
      );
      console.log(`[VideoArticle] Article assigned to "${spaceName}", difficulty: ${difficulty}`);
    }

    await markQueueDone(articleId, queueType, JSON.stringify({ spaceName, difficulty, tags }));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[VideoArticle] processMetadata error:", err);
    await markQueueError(articleId, queueType, errMsg);
  }
}

async function processGlossaryWithQueue(articleId: string) {
  const queueType = "glossary_extract";
  try {
    await markQueueProcessing(articleId, queueType);

    const articleRes = await pool.query(
      `SELECT title, content FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) {
      await markQueueError(articleId, queueType, "Статья не найдена");
      return;
    }

    const completion = await createChatCompletion([
      {
        role: "system",
        content: `Извлеки ключевые термины из статьи. Верни ТОЛЬКО JSON-массив: [{"term":"термин","definition":"определение","shortDefinition":"кратко","category":"категория"}]`,
      },
      {
        role: "user",
        content: `Статья: "${article.title}"\n\n${(article.content || "").substring(0, 3000)}`,
      },
    ]);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      await markQueueDone(articleId, queueType, "AI returned empty response");
      return;
    }

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let terms: Array<{ term: string; definition: string; shortDefinition?: string; category?: string }>;
    try {
      terms = JSON.parse(cleaned);
    } catch {
      await markQueueDone(articleId, queueType, "AI response was not valid JSON");
      return;
    }

    if (!Array.isArray(terms)) {
      await markQueueDone(articleId, queueType, "AI response was not an array");
      return;
    }

    for (const term of terms) {
      if (!term.term || !term.definition) continue;
      const termId = genId("gt_");
      const termSlug = generateSlug(term.term) || `term-${Date.now()}`;
      await pool.query(
        `INSERT INTO glossary_terms (id, term, slug, definition, "shortDefinition", category, "articleId", "aiGenerated", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [termId, term.term, termSlug, term.definition, term.shortDefinition || null, term.category || "AI", articleId]
      );
    }
    console.log(`[VideoArticle] Glossary: ${terms.length} terms extracted`);
    await markQueueDone(articleId, queueType, `${terms.length} terms extracted`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[VideoArticle] processGlossary error:", err);
    await markQueueError(articleId, queueType, errMsg);
  }
}

async function processGraphWithQueue(articleId: string) {
  const queueType = "graph_build";
  try {
    await markQueueProcessing(articleId, queueType);

    const articleRes = await pool.query(
      `SELECT title, content, tags, "keyConcepts" FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) {
      await markQueueError(articleId, queueType, "Статья не найдена");
      return;
    }

    // Build graph connections — find related articles via shared tags/concepts
    const tags = article.tags ? JSON.parse(article.tags) : [];
    const keyConcepts = article.keyConcepts ? JSON.parse(article.keyConcepts) : [];

    if (tags.length === 0 && keyConcepts.length === 0) {
      await markQueueDone(articleId, queueType, "No tags/concepts to build graph");
      return;
    }

    // Find articles with overlapping tags
    const relatedRes = await pool.query(
      `SELECT id, title, tags FROM articles WHERE id != $1 AND tags IS NOT NULL AND status IN ('published', 'pending')`,
      [articleId]
    );

    const prerequisites: string[] = [];
    const nextTopics: string[] = [];

    for (const related of relatedRes.rows) {
      try {
        const relatedTags = JSON.parse(related.tags || "[]");
        const overlap = tags.filter((t: string) => relatedTags.includes(t));
        if (overlap.length > 0) {
          prerequisites.push(related.id);
          if (prerequisites.length >= 3) break;
        }
      } catch { /* skip */ }
    }

    await pool.query(
      `UPDATE articles SET "prerequisites" = $1, "nextTopics" = $2, "updatedAt" = NOW() WHERE id = $3`,
      [JSON.stringify(prerequisites), JSON.stringify(nextTopics), articleId]
    );

    await markQueueDone(articleId, queueType, `Found ${prerequisites.length} prerequisites`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[VideoArticle] processGraph error:", err);
    await markQueueError(articleId, queueType, errMsg);
  }
}

async function processCourseWithQueue(articleId: string) {
  const queueType = "course_draft";
  try {
    await markQueueProcessing(articleId, queueType);

    const articleRes = await pool.query(
      `SELECT title, content FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) {
      await markQueueError(articleId, queueType, "Статья не найдена");
      return;
    }

    const completion = await createChatCompletion([
      {
        role: "system",
        content: `Создай квиз из 5 вопросов и практическое задание по статье. Верни ТОЛЬКО JSON: {"quiz":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}],"practice":{"title":"...","description":"...","hints":["..."]}}`,
      },
      {
        role: "user",
        content: `Статья: "${article.title}"\n\n${(article.content || "").substring(0, 3000)}`,
      },
    ]);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      await markQueueDone(articleId, queueType, "AI returned empty response");
      return;
    }

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned); // validate
      // Store quiz and practical task in real DB columns
      await pool.query(
        `UPDATE articles SET quiz = $1, practical_task = $2, "updatedAt" = NOW() WHERE id = $3`,
        [
          parsed.quiz ? JSON.stringify(parsed.quiz) : null,
          parsed.practice ? JSON.stringify(parsed.practice) : null,
          articleId,
        ]
      );
      console.log(`[VideoArticle] Quiz + practice task saved`);
      await markQueueDone(articleId, queueType, "Quiz + practice created");
    } catch {
      console.warn("[VideoArticle] Course draft was not valid JSON, skipping");
      await markQueueDone(articleId, queueType, "AI response was not valid JSON — skipped");
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[VideoArticle] processCourse error:", err);
    await markQueueError(articleId, queueType, errMsg);
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function generateSlug(title: string): string {
  const map: Record<string, string> = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  };
  return title
    .toLowerCase()
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.slice(7).split("/")[0] || null;
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.slice(8).split("/")[0] || null;
    }
    if (parsed.pathname.startsWith("/live/")) {
      return parsed.pathname.slice(6).split("/")[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}
