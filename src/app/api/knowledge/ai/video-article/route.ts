import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { isZAIConfigured } from "@/lib/zai";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // Full pipeline can take 2-3 minutes

/**
 * POST /api/knowledge/ai/video-article
 *
 * Full pipeline: YouTube URL → extract transcript → create article → AI processing chain
 *
 * Body: { url: string, title?: string }
 *
 * Returns the created article ID and starts background AI processing.
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
        { error: "Z-AI SDK не настроен", code: "ZAI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // Step 1: Call transcript extraction API (internal)
    const transcriptRes = await fetch(new URL("/api/knowledge/video/transcript", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!transcriptRes.ok) {
      const errData = await transcriptRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Не удалось извлечь содержание видео", details: errData.error || errData },
        { status: 500 }
      );
    }

    const transcript = await transcriptRes.json();

    // Step 2: Create the article with extracted content
    const articleTitle = customTitle || transcript.title || `Видео-урок: ${new URL(url).pathname}`;
    const slug = generateSlug(articleTitle) || `video-${Date.now()}`;
    const articleId = genId("art_");

    // Detect source type
    const sourceType = "youtube";

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
        sourceType,
      ]
    );

    // Step 3: Create queue entries for full AI processing chain
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

    // Step 4: If glossary terms were extracted from video, insert them now
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

    // Step 5: Start AI processing chain (fire-and-forget, sequential)
    const processChain = async () => {
      try {
        // Metadata + Categorization
        const metaRes = await fetch(new URL("/api/knowledge/ai", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type: "metadata" }),
        });
        console.log(`[VideoArticle] metadata: ${metaRes.status}`);

        // Glossary
        const glossRes = await fetch(new URL("/api/knowledge/ai", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type: "glossary" }),
        });
        console.log(`[VideoArticle] glossary: ${glossRes.status}`);

        // Graph
        const graphRes = await fetch(new URL("/api/knowledge/ai", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type: "graph" }),
        });
        console.log(`[VideoArticle] graph: ${graphRes.status}`);

        // Course (Quiz + Practice)
        const courseRes = await fetch(new URL("/api/knowledge/ai", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type: "course" }),
        });
        console.log(`[VideoArticle] course: ${courseRes.status}`);
      } catch (err) {
        console.error("[VideoArticle] AI processing chain failed:", err);
      }
    };

    // Don't await — fire and forget
    processChain();

    return NextResponse.json({
      articleId,
      title: articleTitle,
      slug,
      message: "Статья из видео создана. Начинаю AI-обработку...",
      transcriptPreview: {
        title: transcript.title,
        summary: transcript.summary?.substring(0, 200),
        contentLength: transcript.content?.length || 0,
        glossaryCount: transcript.glossaryTerms?.length || 0,
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
