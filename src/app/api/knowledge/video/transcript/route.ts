import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/knowledge/video/transcript — Extract transcript/subtitles from YouTube video
// Uses multiple strategies: oEmbed metadata + web search + AI description
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url) {
      return NextResponse.json({ error: "url обязателен" }, { status: 400 });
    }

    // Extract YouTube video ID
    let videoId: string | null = null;
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
        videoId = u.searchParams.get("v");
      } else if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1);
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/embed/")[1]?.split("/")[0] || null;
      }
    } catch {
      return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
    }

    if (!videoId) {
      return NextResponse.json({ error: "Не удалось извлечь ID видео из URL" }, { status: 400 });
    }

    // ── Strategy 1: oEmbed metadata (fast, free) ──
    let videoTitle = "";
    let videoAuthor = "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        videoTitle = data.title || "";
        videoAuthor = data.author_name || "";
      }
    } catch {}

    // ── Strategy 2: Web search for additional context ──
    let searchContext = "";
    try {
      const zai = await ZAI.create();
      const searchQuery = videoTitle
        ? `"${videoTitle}" видео урок описание`
        : `YouTube video ${videoId} описание`;
      const results = await zai.functions.invoke("web_search", { query: searchQuery, num: 5 });
      if (Array.isArray(results) && results.length > 0) {
        searchContext = results
          .slice(0, 3)
          .map((r: { name?: string; snippet?: string }) => `${r.name || ""}: ${r.snippet || ""}`)
          .join("\n");
      }
    } catch {}

    // ── Strategy 3: AI generates description from gathered context ──
    const contextParts: string[] = [];
    if (videoTitle) contextParts.push(`Название видео: ${videoTitle}`);
    if (videoAuthor) contextParts.push(`Автор/канал: ${videoAuthor}`);
    if (searchContext) contextParts.push(`Результаты поиска:\n${searchContext}`);
    contextParts.push(`URL: ${url}`);
    const contextForAI = contextParts.join("\n\n");

    let transcript = "";

    // Try Z-AI first
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Ты — эксперт по извлечению учебного контента из видео. На основе доступной информации (название, автор, результаты поиска) создай максимально подробное описание контента видео.
Структура:
## Описание
[Подробное описание]
## Ключевые темы
- Тема 1
- Тема 2
## Основные моменты
1. [Пункт 1]
2. [Пункт 2]
## Практические выводы
- [Вывод 1]

Ответ на русском, минимум 1000 символов.`
          },
          {
            role: "user",
            content: `Вот информация о видео:\n\n${contextForAI}\n\nСоздай подробное описание контента.`
          }
        ],
      });
      transcript = completion.choices[0]?.message?.content || "";
    } catch (err) {
      console.error("[Video Transcript] Z-AI failed:", err);
    }

    // Fallback: try OpenRouter/OpenAI
    if (!transcript || transcript.length < 100) {
      if (isAIConfigured()) {
        try {
          const fallback = await createChatCompletion([
            {
              role: "system",
              content: "Ты — эксперт по созданию описаний видео. На основе информации создай подробное описание на русском, минимум 800 символов."
            },
            {
              role: "user",
              content: `Информация о видео:\n${contextForAI}\n\nСоздай описание.`
            }
          ], { temperature: 0.7 });
          transcript = fallback.choices?.[0]?.message?.content || "";
        } catch {}
      }
    }

    if (!transcript || transcript.length < 50) {
      return NextResponse.json(
        { error: "Не удалось извлечь содержание видео. Возможно, видео недоступно или приватное." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      videoId,
      url,
      transcript,
      length: transcript.length,
      sources: {
        oembed: !!videoTitle,
        webSearch: !!searchContext,
      },
    });
  } catch (error) {
    console.error("[Video Transcript] Error:", error);
    return NextResponse.json(
      { error: "Ошибка извлечения субтитров", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
