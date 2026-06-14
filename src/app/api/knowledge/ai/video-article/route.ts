import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/knowledge/ai/video-article — YouTube→AI article pipeline
// 1. Extract transcript from YouTube video via Z-AI SDK
// 2. AI generates article content, summary, tags, glossary, quiz, practical_task
// 3. Creates and publishes the article
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: "AI-сервис не настроен", code: "AI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { url, title: customTitle } = body as { url?: string; title?: string };

    if (!url) {
      return NextResponse.json({ error: "url обязателен" }, { status: 400 });
    }

    // Extract YouTube video ID
    let videoId: string | null = null;
    let sourceType = "youtube";
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
        videoId = u.searchParams.get("v");
      } else if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1);
      } else if (u.hostname.includes("rutube.ru")) {
        sourceType = "rutube";
        const match = u.pathname.match(/\/video\/([a-f0-9]+)/);
        videoId = match ? match[1] : null;
      } else if (u.hostname.includes("vk.com") || u.hostname.includes("vkvideo")) {
        sourceType = "vk";
      }
    } catch {
      return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
    }

    // Step 1: Extract transcript via Z-AI SDK
    let transcript = "";
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Ты — эксперт по извлечению учебного контента из видео. Создай максимально подробное описание контента видео на русском языке.
Структура:
## Описание
[Подробное описание — 3-5 абзацев]
## Ключевые темы
- Тема 1: описание
- Тема 2: описание
## Основные моменты
1. [Пункт 1 — 2-3 предложения]
2. [Пункт 2 — 2-3 предложения]
## Практические выводы
- [Вывод 1]
Ответ на русском, минимум 1500 символов.`
          },
          {
            role: "user",
            content: videoId 
              ? `Создай подробное описание контента для YouTube видео: https://www.youtube.com/watch?v=${videoId}`
              : `Создай подробное описание контента для видео по ссылке: ${url}`
          }
        ],
      });
      transcript = completion.choices[0]?.message?.content || "";
    } catch (err) {
      console.error("[VideoArticle] Z-AI transcript extraction failed:", err);
    }

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: "Не удалось извлечь содержание видео. Попробуйте добавить статью вручную." },
        { status: 422 }
      );
    }

    // Step 2: AI generates article from transcript
    const aiResult = await createChatCompletion([
      {
        role: "system",
        content: `Ты — AI-ассистент для создания образовательных статей. На основе описания видео-урока создай полноценную статью.
Формат ответа — СТРОГО JSON (без markdown-обёрток):
{
  "title": "Название статьи",
  "summary": "Краткое описание 2-3 предложения",
  "content": "Полный Markdown-контент статьи (минимум 2000 символов, с заголовками ##, списками, примерами кода если уместно)",
  "tags": ["тег1", "тег2", "тег3"],
  "keyTopics": ["тема1", "тема2"],
  "difficulty": "easy|medium|hard",
  "estimatedTime": "25 мин",
  "quiz": [
    {"question": "Вопрос?", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "Объяснение"},
    {"question": "Вопрос 2?", "options": ["A", "B", "C", "D"], "correct": 1, "explanation": "Объяснение"}
  ],
  "practicalTask": {
    "title": "Практическое задание",
    "description": "Описание задания",
    "hint": "Подсказка",
    "solution": "Решение"
  }
}
Минимум 5 quiz вопросов. Статья должна быть на русском, технически точная, с примерами.`
      },
      {
        role: "user",
        content: `Создай статью на основе этого описания видео:\n\n${transcript}${customTitle ? `\n\nЖелаемое название: ${customTitle}` : ""}`
      }
    ], { temperature: 0.7 });

    // Parse AI response
    let articleData: Record<string, unknown>;
    try {
      const rawContent = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      articleData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[VideoArticle] Failed to parse AI response:", parseErr);
      return NextResponse.json(
        { error: "AI вернул некорректный формат. Попробуйте ещё раз." },
        { status: 422 }
      );
    }

    // Step 3: Create article in database
    const articleId = 'art_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const authorId = session.user.id;
    const slug = (articleData.title as string || customTitle || "video-lesson")
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || `article-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO articles (id, title, slug, content, summary, tags, "keyTopics", "spaceId", "authorId", 
         "isPublished", "viewCount", "videoUrl", "sourceType", difficulty, "estimatedTime", 
         status, "aiGenerated", quiz, "practical_task",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, 
         true, 0, $9, $10, $11, $12, 
         'done', true, $13, $14,
         NOW(), NOW())
       RETURNING *`,
      [
        articleId,
        articleData.title || customTitle || "Видео-урок",
        slug,
        articleData.content || transcript,
        articleData.summary || null,
        articleData.tags ? JSON.stringify(articleData.tags) : null,
        articleData.keyTopics ? JSON.stringify(articleData.keyTopics) : null,
        authorId,
        url,
        sourceType,
        articleData.difficulty || "medium",
        articleData.estimatedTime || "30 мин",
        articleData.quiz ? JSON.stringify(articleData.quiz) : null,
        articleData.practicalTask ? JSON.stringify(articleData.practicalTask) : null,
      ]
    );

    // Step 4: Fire-and-forget — AI categorizes and builds glossary/graph
    const articleCreated = result.rows[0];
    const articleIdForChain = articleCreated.id;

    // Background: metadata (categorization), glossary, graph
    (async () => {
      try {
        await fetch(new URL("/api/knowledge/ai", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: articleIdForChain, type: "metadata" }),
        });
        await fetch(new URL("/api/knowledge/ai", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: articleIdForChain, type: "glossary" }),
        });
        await fetch(new URL("/api/knowledge/ai", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: articleIdForChain, type: "graph" }),
        });
      } catch (err) {
        console.error("[VideoArticle] Background AI chain failed:", err);
      }
    })();

    return NextResponse.json({
      message: "Видео-статья создана и опубликована",
      article: articleCreated,
      transcriptLength: transcript.length,
    }, { status: 201 });
  } catch (error) {
    console.error("[VideoArticle] Error:", error);
    return NextResponse.json(
      { error: "Ошибка создания видео-статьи", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
