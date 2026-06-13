import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createZAI, isZAIConfigured } from "@/lib/zai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/knowledge/video/transcript
 *
 * Accepts a YouTube URL, extracts video ID, and uses Z-AI SDK
 * to get transcript/content from the video.
 *
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url) {
      return NextResponse.json({ error: "URL видео обязателен" }, { status: 400 });
    }

    // Extract YouTube video ID from various URL formats
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Не удалось извлечь ID видео из URL. Поддерживаются ссылки YouTube." },
        { status: 400 }
      );
    }

    // Use Z-AI to extract video content via web search + AI summarization
    if (!isZAIConfigured()) {
      return NextResponse.json(
        { error: "Z-AI SDK не настроен", code: "ZAI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const zai = createZAI();

    // Step 1: Search for video metadata and transcript info
    const searchResult = await zai.functions.invoke("web_search", {
      query: `youtube ${videoId} transcript subtitles текст содержание`,
      num: 5,
    });

    // Step 2: Use AI chat to generate article from video info
    const searchContext = Array.isArray(searchResult)
      ? searchResult.map((r: { name?: string; snippet?: string; url?: string }) =>
          `${r.name || ""}: ${r.snippet || ""} (${r.url || ""})`
        ).join("\n")
      : "";

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
          content: `Видео URL: ${url}\nVideo ID: ${videoId}\n\nПоисковые данные:\n${searchContext}`,
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
    let parsed: Record<string, unknown>;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If AI didn't return valid JSON, wrap it
      parsed = {
        title: `Видео: ${videoId}`,
        content: aiResponse,
        summary: aiResponse.substring(0, 200),
        tags: [],
        keyConcepts: [],
        glossaryTerms: [],
      };
    }

    return NextResponse.json({
      videoId,
      sourceUrl: url,
      ...parsed,
    });
  } catch (error) {
    console.error("[Video Transcript] Error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: "Ошибка обработки видео", details: message },
      { status: 500 }
    );
  }
}

/**
 * Extract YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // youtu.be short format
    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    // youtube.com/watch?v=...
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }

    // youtube.com/embed/VIDEO_ID
    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.slice(7).split("/")[0] || null;
    }

    // youtube.com/shorts/VIDEO_ID
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.slice(8).split("/")[0] || null;
    }

    // youtube.com/live/VIDEO_ID
    if (parsed.pathname.startsWith("/live/")) {
      return parsed.pathname.slice(6).split("/")[0] || null;
    }

    return null;
  } catch {
    return null;
  }
}
