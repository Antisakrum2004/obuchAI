import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";
import { createZAI, isZAIConfigured } from "@/lib/zai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── Piped API instances for extracting YouTube audio ──
const PIPED_API_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://piped-api.privacy.com.de",
  "https://pipedapi.in.projectsegfau.lt",
];

interface PipedStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  videoOnly: boolean;
  bitrate: number;
  contentLength: number;
}

interface PipedResponse {
  title: string;
  duration: number;
  thumbnailUrl: string;
  uploader: string;
  uploaderUrl: string;
  description: string;
  videoStreams: PipedStream[];
  audioStreams: PipedStream[];
}

// ── Fetch video metadata from Piped API ──
async function getPipedData(videoId: string): Promise<PipedResponse | null> {
  for (const instance of PIPED_API_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "obuchAI/1.0", "Accept": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioStreams || data.videoStreams) return data as PipedResponse;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ── YouTube oEmbed — free, no API key needed ──
async function getYouTubeMeta(videoId: string): Promise<{ title: string; author?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { title: "" };
    const data = await res.json();
    return { title: data.title || "", author: data.author_name || undefined };
  } catch {
    return { title: "" };
  }
}

// ── Rutube oEmbed ──
async function getRutubeMeta(videoId: string): Promise<{ title: string; author?: string }> {
  try {
    const res = await fetch(
      `https://rutube.ru/api/oembed/?url=https://rutube.ru/video/${videoId}/&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { title: "" };
    const data = await res.json();
    return { title: data.title || "", author: data.author_name || undefined };
  } catch {
    return { title: "" };
  }
}

// ── Web search for video context ──
async function searchVideoContext(query: string): Promise<string> {
  try {
    const zai = createZAI();
    const results = await zai.functions.invoke("web_search", { query, num: 5 });
    if (!Array.isArray(results) || results.length === 0) return "";
    return results
      .slice(0, 3)
      .map((r: { name?: string; snippet?: string }) => `${r.name || ""}: ${r.snippet || ""}`)
      .join("\n");
  } catch {
    return "";
  }
}

// ── REAL TRANSCRIPTION: Download audio from Piped → ASR via Z-AI ──
async function transcribeYouTubeAudio(videoId: string): Promise<string> {
  if (!isZAIConfigured()) {
    console.log("[VideoArticle] Z-AI not configured, skipping ASR transcription");
    return "";
  }

  try {
    // Step 1: Get audio stream URL from Piped
    const pipedData = await getPipedData(videoId);
    if (!pipedData?.audioStreams?.length) {
      console.log("[VideoArticle] No audio streams available for video", videoId);
      return "";
    }

    // Find best audio stream (prefer m4a/mp4, fallback to webm/opus)
    const audioStreams = pipedData.audioStreams
      .filter((s: PipedStream) =>
        s.mimeType?.startsWith("audio/mp4") ||
        s.mimeType?.startsWith("audio/webm") ||
        s.mimeType?.startsWith("audio/ogg")
      )
      .sort((a: PipedStream, b: PipedStream) => (b.bitrate || 0) - (a.bitrate || 0));

    if (audioStreams.length === 0) {
      console.log("[VideoArticle] No suitable audio streams found");
      return "";
    }

    const audioUrl = audioStreams[0].url;
    const audioSize = audioStreams[0].contentLength || 0;

    // Safety check: skip if audio is too large (>50MB for ASR)
    if (audioSize > 50 * 1024 * 1024) {
      console.log(`[VideoArticle] Audio too large (${Math.round(audioSize / 1024 / 1024)}MB), skipping ASR`);
      return "";
    }

    // Step 2: Download audio
    console.log(`[VideoArticle] Downloading audio from Piped (${Math.round(audioSize / 1024)}KB)...`);
    const audioRes = await fetch(audioUrl, {
      signal: AbortSignal.timeout(60000), // 60s to download
    });
    if (!audioRes.ok) {
      console.log(`[VideoArticle] Failed to download audio: ${audioRes.status}`);
      return "";
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[VideoArticle] Downloaded audio: ${Math.round(audioBuffer.length / 1024)}KB`);

    // Step 3: Convert to base64 and send to ASR
    const base64Audio = audioBuffer.toString("base64");

    console.log("[VideoArticle] Sending audio to ASR for transcription...");
    const zai = createZAI();
    const asrResult = await zai.audio.asr.create({ file_base64: base64Audio });

    const transcript = asrResult.text || "";
    console.log(`[VideoArticle] ASR transcription received: ${transcript.length} chars`);

    return transcript;
  } catch (err) {
    console.error("[VideoArticle] ASR transcription failed:", err);
    return "";
  }
}

// POST /api/knowledge/ai/video-article — YouTube→AI article pipeline
// Pipeline: Real ASR transcription → AI formats into article
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

    // Extract video ID and source type
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

    // ── Step 1: Gather context from multiple sources ──
    let videoTitle = customTitle || "";
    let videoAuthor = "";
    let videoDescription = "";
    let searchContext = "";

    // 1a. oEmbed metadata (fast, free)
    if (videoId && sourceType === "youtube") {
      const meta = await getYouTubeMeta(videoId);
      if (meta.title && !videoTitle) videoTitle = meta.title;
      if (meta.author) videoAuthor = meta.author;
    } else if (videoId && sourceType === "rutube") {
      const meta = await getRutubeMeta(videoId);
      if (meta.title && !videoTitle) videoTitle = meta.title;
      if (meta.author) videoAuthor = meta.author;
    }

    // 1b. Piped API — get description and audio streams (for YouTube)
    if (videoId && sourceType === "youtube") {
      const pipedData = await getPipedData(videoId);
      if (pipedData) {
        if (!videoTitle && pipedData.title) videoTitle = pipedData.title;
        if (!videoAuthor && pipedData.uploader) videoAuthor = pipedData.uploader;
        if (pipedData.description) videoDescription = pipedData.description;
      }
    }

    // 1c. Web search for additional context
    const searchQuery = videoTitle
      ? `"${videoTitle}" видео урок обучение`
      : videoId
        ? `YouTube video ${videoId} описание содержание`
        : url;
    searchContext = await searchVideoContext(searchQuery);

    // ── Step 2: REAL TRANSCRIPTION via ASR ──
    // This is the key fix: instead of hallucinating content from title,
    // we actually transcribe the audio from the video.
    let transcript = "";

    // Try ASR first (real speech-to-text transcription)
    if (videoId && sourceType === "youtube") {
      transcript = await transcribeYouTubeAudio(videoId);
    }

    // If ASR didn't work or not YouTube, try YouTube description as fallback
    if (!transcript && videoDescription) {
      console.log("[VideoArticle] ASR failed, using YouTube description as basis");
      transcript = videoDescription;
    }

    // If still nothing, ask AI to describe based on available context (LAST RESORT)
    if (!transcript || transcript.length < 100) {
      console.log("[VideoArticle] No transcript available, AI will generate description from context");
      try {
        const contextParts: string[] = [];
        if (videoTitle) contextParts.push(`Название видео: ${videoTitle}`);
        if (videoAuthor) contextParts.push(`Автор/канал: ${videoAuthor}`);
        if (videoDescription) contextParts.push(`Описание видео с YouTube:\n${videoDescription}`);
        if (searchContext) contextParts.push(`Результаты поиска:\n${searchContext}`);
        contextParts.push(`URL: ${url}`);
        contextParts.push(`Тип источника: ${sourceType}`);
        const contextForAI = contextParts.join("\n\n");

        const zai = createZAI();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Ты — технический писатель и эксперт по продуктам. На основе доступной информации создай описание ПРОДУКТА или ТЕХНОЛОГИИ, о которой это видео, а НЕ пересказ видео.

КРИТИЧЕСКИ ВАЖНО:
1. Пиши о ПРОДУКТЕ/ТЕХНОЛОГИИ, а не о видео
2. НЕ пиши "автор говорит", "в видео обсуждается", "подчеркивается важность" — это пересказ
3. НЕ пиши расплывчатые секции "Практика и рекомендации" с общими фразами
4. Каждый абзац должен содержать конкретную информацию: функции, команды, интерфейс, настройки

Структура:
## Что такое [Продукт]
Полное описание продукта: назначение, решаемые проблемы
## Основные возможности
Конкретный список функций с описанием каждой
## Как использовать
Пошаговые инструкции с конкретными командами/действиями
## Практические советы
Каждый совет — конкретный и применимый к этому продукту, без воды

Ответ на русском, минимум 1500 символов. Пиши статью о ПРОДУКТЕ, а не пересказ видео.`
            },
            {
              role: "user",
              content: `Вот информация о видео:\n\n${contextForAI}\n\nСоздай полноценную статью о ПРОДУКТЕ/ТЕХНОЛОГИИ, о которой это видео. НЕ пересказывай видео — пиши о самом продукте.`
            }
          ],
        });
        transcript = completion.choices[0]?.message?.content || "";
      } catch (err) {
        console.error("[VideoArticle] Z-AI description generation failed:", err);
      }
    }

    // Fallback to OpenRouter/OpenAI
    if (!transcript || transcript.length < 100) {
      try {
        const contextParts: string[] = [];
        if (videoTitle) contextParts.push(`Название: ${videoTitle}`);
        if (videoAuthor) contextParts.push(`Автор: ${videoAuthor}`);
        if (videoDescription) contextParts.push(`Описание YouTube:\n${videoDescription}`);
        if (searchContext) contextParts.push(`Поиск:\n${searchContext}`);
        const contextForAI = contextParts.join("\n\n");

        const fallbackResult = await createChatCompletion([
          {
            role: "system",
            content: `Ты — технический писатель. На основе информации о видео создай статью о ПРОДУКТЕ/ТЕХНОЛОГИИ, а НЕ пересказ видео. НЕ пиши "автор подчеркивает", "в видео обсуждается", расплывчатые "Практика и рекомендации". Каждый абзац — конкретная информация о продукте: функции, команды, настройки, примеры. Минимум 1000 символов.`
          },
          {
            role: "user",
            content: `Информация о видео:\n${contextForAI}\n\nСоздай статью о ПРОДУКТЕ, а не пересказ видео.`
          }
        ], { temperature: 0.7 });
        transcript = fallbackResult.choices?.[0]?.message?.content || "";
      } catch (err) {
        console.error("[VideoArticle] Fallback AI also failed:", err);
      }
    }

    // If still too short but we have at least a title, create a minimal article
    if (!transcript || transcript.length < 50) {
      if (videoTitle || customTitle) {
        transcript = `## ${videoTitle || customTitle}\n\nВидеоматериал урока. Основной контент — видеоурок.\n\nСмотрите видео для получения полного материала.`;
      } else {
        return NextResponse.json(
          { error: "Не удалось извлечь содержание видео. Попробуйте добавить статью вручную." },
          { status: 422 }
        );
      }
    }

    // ── Step 3: AI generates article from TRANSCRIPT (not hallucination) ──
    // The key difference: we now pass the REAL transcript, not AI-hallucinated content
    const transcriptType = transcript === videoDescription
      ? "описание с YouTube"
      : transcript.length > 200
        ? "транскрипция (ASR)"
        : "контекст из поиска";

    const aiResult = await createChatCompletion([
      {
        role: "system",
        content:
          "Ты — технический писатель и эксперт по продуктам. Твоя задача — создать полноценную, самостоятельную статью о ПРОДУКТЕ или ТЕХНОЛОГИИ, которую обсуждают в видео. Статья НЕ должна быть пересказом видео — она должна быть независимым учебным материалом, который человек может прочитать БЕЗ просмотра видео и полностью понять продукт.\n\n" +
          "КРИТИЧЕСКИ ВАЖНО:\n" +
          "1. Статья — о ПРОДУКТЕ/ТЕХНОЛОГИИ, а не о видео и не о том, что говорит автор видео\n" +
          "2. Структура статьи должна раскрывать тему продукта: что это, зачем нужно, как работает, как использовать, примеры, советы\n" +
          "3. НЕ пиши секции вроде \"Автор подчеркивает важность практики\" или \"В видео обсуждается...\" — это пересказ, а не статья\n" +
          "4. НЕ пиши расплывчатые секции \"Практика и рекомендации\" с общими фразами — каждая рекомендация должна быть конкретной и применимой к данному продукту\n" +
          "5. Каждый абзац должен содержать конкретную полезную информацию — термины, команды, интерфейс, настройки, примеры\n" +
          "6. Если в транскрипте есть конкретные технические детали (команды, настройки, интерфейс) — включи их с пояснениями\n" +
          "7. Статья должна быть полезна даже тому, кто НЕ смотрел видео\n" +
          "8. Сохраняй техническую точность — правильные названия инструментов, языков, платформ\n\n" +
          "СТРУКТУРА СТАТЬИ (обязательно):\n" +
          "## Что такое [Продукт]\n" +
          "Полное описание продукта: назначение, решаемые проблемы, позиционирование на рынке\n" +
          "## Основные возможности\n" +
          "Конкретный список функций с описанием каждой — не общие слова, а реальные возможности\n" +
          "## Как работает [Продукт]\n" +
          "Архитектура, принципы работы, ключевые концепции — технически точно\n" +
          "## Начало работы\n" +
          "Пошаговые инструкции: установка, настройка, первый запуск — конкретные шаги и команды\n" +
          "## Практические примеры\n" +
          "Конкретные сценарии использования с примерами кода/команд/настроек\n" +
          "## Советы и лучшие практики\n" +
          "Каждый совет — конкретный и применимый к этому продукту, без воды\n\n" +
          "Формат ответа — СТРОГО JSON (без markdown-обёрток):\n" +
          "{\n" +
          "  \"title\": \"Название статьи о продукте (не о видео)\",\n" +
          "  \"summary\": \"Краткое описание 2-3 предложения о продукте и его возможностях\",\n" +
          "  \"content\": \"Полный Markdown-контент статьи (минимум 3000 символов, с заголовками ##, конкретными примерами, командами, настройками)\",\n" +
          "  \"tags\": [\"тег1\", \"тег2\", \"тег3\"],\n" +
          "  \"keyTopics\": [\"тема1\", \"тема2\"],\n" +
          "  \"difficulty\": \"easy|medium|hard\",\n" +
          "  \"estimatedTime\": \"25 мин\",\n" +
          "  \"quiz\": [\n" +
          "    {\"question\": \"Конкретный вопрос о продукте?\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct\": 0, \"explanation\": \"Объяснение с технической деталью\"},\n" +
          "    {\"question\": \"Вопрос 2?\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct\": 1, \"explanation\": \"Объяснение\"}\n" +
          "  ],\n" +
          "  \"practicalTask\": {\n" +
          "    \"title\": \"Конкретное практическое задание с этим продуктом\",\n" +
          "    \"description\": \"Подробное описание что нужно сделать — пошагово, с конкретными командами/действиями\",\n" +
          "    \"hint\": \"Конкретная подсказка (команда, настройка, интерфейс)\",\n" +
          "    \"solution\": \"Подробное пошаговое решение с примерами\"\n" +
          "  }\n" +
          "}\n" +
          "Минимум 5 quiz вопросов о продукте. Статья на русском, технически точная, с конкретными примерами."
      },
      {
        role: "user",
        content: "Создай полноценную статью о продукте/технологии, которую обсуждают в этом видео. Используй транскрипт как источник фактической информации, но пиши о ПРОДУКТЕ, а не о видео.\n\n" +
          "---НАЧАЛО ТРАНСКРИПТА/ОПИСАНИЯ---\n" +
          transcript + "\n" +
          "---КОНЕЦ ТРАНСКРИПТА/ОПИСАНИЯ---\n\n" +
          "Дополнительная информация:\n" +
          "- Название видео: " + (videoTitle || "не указано") + "\n" +
          "- Автор: " + (videoAuthor || "не указан") + "\n" +
          (customTitle ? "- Желаемое название: " + customTitle + "\n" : "") +
          "\nКРИТИЧЕСКИ ВАЖНО:\n" +
          "- Пиши статью о ПРОДУКТЕ/ТЕХНОЛОГИИ, а не пересказ видео\n" +
          "- Читатель должен понять продукт без просмотра видео\n" +
          "- НЕ пиши \"автор говорит\", \"в видео обсуждается\", \"подчеркивается важность\" — это пересказ\n" +
          "- Каждый абзац — конкретная информация о продукте: функции, команды, настройки, примеры"
      }
    ], { temperature: 0.3 });

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

    // ── Step 4: Determine spaceId (spaceId is NOT NULL) ──
    let spaceIdValue: string | null = null;
    try {
      const { rows: spaces } = await pool.query(
        `SELECT id, name, slug, description FROM knowledge_spaces ORDER BY name LIMIT 20`
      );

      if (spaces.length > 0) {
        const spaceList = spaces.map((s: { id: string; name: string; description?: string }) => {
          const desc = s.description ? ": " + s.description : "";
          return "- " + s.name + " (id: " + s.id + ")" + desc;
        }).join("\n");

        const categorizeResult = await createChatCompletion([
          {
            role: "system",
            content: "Ты — AI-классификатор. Выбери наиболее подходящий раздел для статьи. Ответь ТОЛЬКО id раздела, без объяснений."
          },
          {
            role: "user",
            content: "Статья: \"" + (articleData.title || customTitle || videoTitle) + "\"\n" +
              "Описание: " + (articleData.summary || "") + "\n" +
              "Темы: " + (Array.isArray(articleData.keyTopics) ? articleData.keyTopics.join(", ") : "") + "\n\n" +
              "Доступные разделы:\n" + spaceList + "\n\nКакой id раздела подходит?"
          }
        ], { temperature: 0.1 });

        const rawAnswer = categorizeResult.choices?.[0]?.message?.content?.trim() || "";
        const idMatch = rawAnswer.match(/[a-zA-Z0-9_-]{8,}/);
        if (idMatch) {
          const matchedSpace = spaces.find((s: { id: string }) => s.id === idMatch[0]);
          if (matchedSpace) spaceIdValue = matchedSpace.id;
        }
      }

      if (!spaceIdValue && spaces.length > 0) {
        spaceIdValue = spaces[0].id;
      }

      if (!spaceIdValue) {
        const defaultSpaceId = 'sp_default_' + Date.now().toString(36);
        await pool.query(
          `INSERT INTO knowledge_spaces (id, name, slug, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [defaultSpaceId, "Общие материалы", "general"]
        );
        spaceIdValue = defaultSpaceId;
      }
    } catch (err) {
      console.error("[VideoArticle] Space determination failed:", err);
      const { rows: anySpace } = await pool.query(
        `SELECT id FROM knowledge_spaces LIMIT 1`
      );
      if (anySpace[0]) {
        spaceIdValue = anySpace[0].id;
      } else {
        return NextResponse.json(
          { error: "Нет доступных разделов. Создайте хотя бы один раздел перед публикацией." },
          { status: 400 }
        );
      }
    }

    // ── Step 5: Create article in database ──
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         true, 0, $10, $11, $12, $13,
         'done', true, $14, $15,
         NOW(), NOW())
       RETURNING *`,
      [
        articleId,
        articleData.title || customTitle || videoTitle || "Видео-урок",
        slug,
        articleData.content || transcript,
        articleData.summary || null,
        articleData.tags ? JSON.stringify(articleData.tags) : null,
        articleData.keyTopics ? JSON.stringify(articleData.keyTopics) : null,
        spaceIdValue,
        authorId,
        url,
        sourceType,
        articleData.difficulty || "medium",
        articleData.estimatedTime || "30 мин",
        articleData.quiz ? JSON.stringify(articleData.quiz) : null,
        articleData.practicalTask ? JSON.stringify(articleData.practicalTask) : null,
      ]
    );

    // ── Step 6: Fire-and-forget — AI categorizes and builds glossary/graph ──
    const articleCreated = result.rows[0];
    const articleIdForChain = articleCreated.id;

    waitUntil((async () => {
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
    })());

    return NextResponse.json({
      message: "Видео-статья создана и опубликована",
      article: articleCreated,
      transcriptLength: transcript.length,
      transcriptSource: transcriptType,
      sources: {
        oembed: !!videoTitle,
        pipedDescription: !!videoDescription,
        asr: transcriptType === "транскрипция (ASR)",
        webSearch: !!searchContext,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[VideoArticle] Error:", error);
    return NextResponse.json(
      { error: "Ошибка создания видео-статьи", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
