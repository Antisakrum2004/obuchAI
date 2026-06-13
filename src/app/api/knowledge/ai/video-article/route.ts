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

    // Step 2: Create the article
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
        NULL, $8, $9, $10,
        'pending', false, true, NOW(), NOW()
      )`,
      [
        articleId,
        articleTitle,
        slug,
        transcript.content || "Содержимое будет добавлено после обработки",
        transcript.summary || null,
        transcript.tags ? JSON.stringify(transcript.tags) : null,
        transcript.keyConcepts ? JSON.stringify(transcript.keyConcepts) : null,
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

    // Step 5: Fire-and-forget AI processing chain (metadata → categorize, glossary, graph, course)
    const processChain = async () => {
      try {
        // Metadata: determine space, difficulty, tags → then publish
        await processMetadata(articleId);
        // Glossary: extract additional terms
        await processGlossary(articleId);
        // Course: create quiz + practice
        await processCourse(articleId);
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
      message: "Статья из видео создана. Начинаю AI-обработку...",
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

// ── AI Processing Steps ─────────────────────────────────────────

async function processMetadata(articleId: string) {
  try {
    const articleRes = await pool.query(
      `SELECT title, content, summary FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) return;

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
    if (!response) return;

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
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
        `UPDATE articles SET "spaceId" = $1, difficulty = $2, tags = $3, status = 'published', "isPublished" = true, "updatedAt" = NOW() WHERE id = $4`,
        [spaceId, difficulty || null, tags ? JSON.stringify(tags) : null, articleId]
      );
      console.log(`[VideoArticle] Article assigned to "${spaceName}", difficulty: ${difficulty}`);
    }
  } catch (err) {
    console.error("[VideoArticle] processMetadata error:", err);
  }
}

async function processGlossary(articleId: string) {
  try {
    const articleRes = await pool.query(
      `SELECT title, content FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) return;

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
    if (!response) return;

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let terms: Array<{ term: string; definition: string; shortDefinition?: string; category?: string }>;
    try {
      terms = JSON.parse(cleaned);
    } catch {
      return;
    }

    if (!Array.isArray(terms)) return;

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
  } catch (err) {
    console.error("[VideoArticle] processGlossary error:", err);
  }
}

async function processCourse(articleId: string) {
  try {
    const articleRes = await pool.query(
      `SELECT title, content FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) return;

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
    if (!response) return;

    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      JSON.parse(cleaned); // validate
      // Store as article metadata
      await pool.query(
        `UPDATE articles SET "courseDraft" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [cleaned, articleId]
      );
      console.log(`[VideoArticle] Course draft created`);
    } catch {
      console.warn("[VideoArticle] Course draft was not valid JSON, skipping");
    }
  } catch (err) {
    console.error("[VideoArticle] processCourse error:", err);
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
