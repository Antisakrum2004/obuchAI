import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { createZAI, isZAIConfigured } from "@/lib/zai";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // Full pipeline can take 2-3 minutes

/**
 * POST /api/knowledge/ai/video-article
 *
 * Full pipeline: YouTube URL → Z-AI extracts content → create article → AI processing chain
 * All logic inline — no internal fetch calls (avoids serverless self-call issues).
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

    // Check Z-AI is configured
    if (!isZAIConfigured()) {
      return NextResponse.json(
        { error: "Z-AI SDK не настроен. Добавьте ZAI_BASE_URL и ZAI_API_KEY в env.", code: "ZAI_NOT_CONFIGURED" },
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

    const zai = createZAI();

    // Step 1: Search for video metadata and transcript info
    console.log(`[VideoArticle] Searching for video ${videoId}...`);
    let searchContext = "";
    try {
      const searchResult = await zai.functions.invoke("web_search", {
        query: `youtube ${videoId} transcript содержание текст`,
        num: 5,
      });
      searchContext = Array.isArray(searchResult)
        ? searchResult.map((r: { name?: string; snippet?: string; url?: string }) =>
            `${r.name || ""}: ${r.snippet || ""} (${r.url || ""})`
          ).join("\n")
        : "";
      console.log(`[VideoArticle] Search returned ${Array.isArray(searchResult) ? searchResult.length : 0} results`);
    } catch (searchErr) {
      console.warn("[VideoArticle] Web search failed, proceeding without it:", searchErr);
      // Continue without search — AI can still work with video URL
    }

    // Step 2: Use AI to generate article from video info
    console.log(`[VideoArticle] Calling AI to generate article...`);
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Ты — AI-ассистент для извлечения содержания из видео. На основе поисковых данных о видео создай подробное содержание.

Правила:
1. Создай ПОДРОБНЫЙ конспект видео (минимум 1500 слов)
2. Структурируй по разделам с заголовками
3. Включи все ключевые концепции, термины и примеры
4. Используй Markdown-форматирование
5. Если данных о видео недостаточно — укажи это и создай что возможно

Верни JSON:
{
  "title": "Название видео (адаптированное для статьи)",
  "content": "Markdown-содержание статьи...",
  "summary": "Краткое описание (2-3 предложения)",
  "tags": ["тег1", "тег2"],
  "keyConcepts": ["концепция1", "концепция2"],
  "glossaryTerms": [
    {"term": "термин", "definition": "определение", "shortDefinition": "кратко", "category": "AI"}
  ]
}`,
        },
        {
          role: "user",
          content: `Видео URL: ${url}\nVideo ID: ${videoId}\n\nПоисковые данные:\n${searchContext || "Нет поисковых данных"}`,
        },
      ],
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      return NextResponse.json(
        { error: "AI не вернул результат обработки видео" },
        { status: 500 }
      );
    }

    // Parse AI response
    let transcript: Record<string, unknown>;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      transcript = JSON.parse(cleaned);
    } catch {
      // If AI didn't return valid JSON, wrap it
      transcript = {
        title: `Видео: ${videoId}`,
        content: aiResponse,
        summary: aiResponse.substring(0, 200),
        tags: [],
        keyConcepts: [],
        glossaryTerms: [],
      };
    }

    console.log(`[VideoArticle] Transcript parsed, title: ${transcript.title}, content length: ${String(transcript.content || "").length}`);

    // Step 3: Create the article with extracted content
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

    // Step 4: Create queue entries for full AI processing chain
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

    // Step 5: If glossary terms were extracted from video, insert them now
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

    // Step 6: Fire-and-forget AI processing chain
    // These calls go to external Z-AI API, not internal routes — safe for serverless
    const processChain = async () => {
      try {
        // Metadata + Categorization (assign space, difficulty)
        await processAIStep(articleId, "metadata");
        // Glossary extraction
        await processAIStep(articleId, "glossary");
        // Knowledge graph
        await processAIStep(articleId, "graph");
        // Course (Quiz + Practice)
        await processAIStep(articleId, "course");
      } catch (err) {
        console.error("[VideoArticle] AI processing chain failed:", err);
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

// ── Helper: process single AI step ────────────────────────────────
async function processAIStep(articleId: string, type: string) {
  try {
    const zai = createZAI();

    const prompts: Record<string, string> = {
      metadata: `Проанализируй статью и определи: 1) В какой раздел (space) её отнести 2) Уровень сложности (easy/medium/hard) 3) Теги. Верни JSON: {"spaceName":"название","difficulty":"easy|medium|hard","tags":["т1","т2"]}`,
      glossary: `Извлеки ключевые термины из статьи. Верни JSON-массив: [{"term":"термин","definition":"определение","shortDefinition":"кратко","category":"категория"}]`,
      graph: `Создай связи этой статьи с другими темами. Верни JSON: {"relations":[{"target":"название темы","type":"prerequisite|related|extends"}]}`,
      course: `Создай квиз из 5 вопросов и практическое задание по статье. Верни JSON: {"quiz":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}],"practice":{"title":"...","description":"...","hints":["..."]}}`,
    };

    // Get article content first
    const articleRes = await pool.query(
      `SELECT title, content, summary FROM articles WHERE id = $1`,
      [articleId]
    );
    const article = articleRes.rows[0];
    if (!article) return;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: prompts[type] || prompts.metadata },
        { role: "user", content: `Статья: "${article.title}"\n\n${(article.content || "").substring(0, 3000)}` },
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) return;

    // Parse and apply results
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn(`[VideoArticle] AI step ${type} returned non-JSON, skipping`);
      return;
    }

    if (type === "metadata") {
      // Find or create space
      const spaceName = parsed.spaceName as string;
      const difficulty = parsed.difficulty as string;
      const tags = parsed.tags as string[];

      if (spaceName) {
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
        }
        // Update article with space and difficulty
        await pool.query(
          `UPDATE articles SET "spaceId" = $1, difficulty = $2, tags = $3, status = 'published', "isPublished" = true, "updatedAt" = NOW() WHERE id = $4`,
          [spaceId, difficulty || null, tags ? JSON.stringify(tags) : null, articleId]
        );
        console.log(`[VideoArticle] Article assigned to space "${spaceName}" (${spaceId}), difficulty: ${difficulty}`);
      }
    }
  } catch (err) {
    console.error(`[VideoArticle] AI step ${type} failed:`, err);
  }
}

// ── Slug generator (Cyrillic → Latin) ─────────────────────────
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

// ── Extract YouTube video ID ──────────────────────────────────
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
