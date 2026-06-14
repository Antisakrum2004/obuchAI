import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  description: string;
  videoStreams: PipedStream[];
  audioStreams: PipedStream[];
}

// ── Fetch video data from Piped API (metadata + audio streams) ──
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

// POST /api/knowledge/video/transcript — Extract transcript from YouTube video
// Pipeline: ASR (real speech-to-text) → fallback to oEmbed + web search + AI description
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

    // ── Strategy 1: REAL ASR transcription (download audio → speech-to-text) ──
    let transcript = "";
    let transcriptSource = "none";

    if (isZAIConfigured()) {
      try {
        // Get audio stream URL from Piped API
        const pipedData = await getPipedData(videoId);

        if (pipedData?.audioStreams?.length) {
          // Find best audio stream
          const audioStreams = pipedData.audioStreams
            .filter((s: PipedStream) =>
              s.mimeType?.startsWith("audio/mp4") ||
              s.mimeType?.startsWith("audio/webm") ||
              s.mimeType?.startsWith("audio/ogg")
            )
            .sort((a: PipedStream, b: PipedStream) => (b.bitrate || 0) - (a.bitrate || 0));

          if (audioStreams.length > 0) {
            const audioUrl = audioStreams[0].url;
            const audioSize = audioStreams[0].contentLength || 0;

            // Safety check: skip if audio is too large (>50MB for ASR)
            if (audioSize > 50 * 1024 * 1024) {
              console.log(`[Transcript] Audio too large (${Math.round(audioSize / 1024 / 1024)}MB), skipping ASR`);
            } else {
              // Download audio
              console.log(`[Transcript] Downloading audio from Piped (${Math.round(audioSize / 1024)}KB)...`);
              const audioRes = await fetch(audioUrl, {
                signal: AbortSignal.timeout(60000),
              });

              if (audioRes.ok) {
                const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
                console.log(`[Transcript] Downloaded audio: ${Math.round(audioBuffer.length / 1024)}KB`);

                // Send to ASR
                const base64Audio = audioBuffer.toString("base64");
                const zai = createZAI();
                const asrResult = await zai.audio.asr.create({ file_base64: base64Audio });

                transcript = asrResult.text || "";
                if (transcript.length > 50) {
                  transcriptSource = "asr";
                  console.log(`[Transcript] ASR transcription: ${transcript.length} chars`);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[Transcript] ASR failed:", err);
      }
    }

    // ── Strategy 2: Use YouTube description from Piped ──
    if (!transcript || transcript.length < 50) {
      try {
        const pipedData = await getPipedData(videoId);
        if (pipedData?.description && pipedData.description.length > 50) {
          transcript = pipedData.description;
          transcriptSource = "piped_description";
          console.log(`[Transcript] Using Piped description: ${transcript.length} chars`);
        }
      } catch {}
    }

    // ── Strategy 3: oEmbed metadata (fast, free) ──
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

    // ── Strategy 4: Web search for additional context ──
    let searchContext = "";
    try {
      const zai = createZAI();
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

    // ── Strategy 5: AI generates description from gathered context (LAST RESORT) ──
    if (!transcript || transcript.length < 50) {
      const contextParts: string[] = [];
      if (videoTitle) contextParts.push(`Название видео: ${videoTitle}`);
      if (videoAuthor) contextParts.push(`Автор/канал: ${videoAuthor}`);
      if (searchContext) contextParts.push(`Результаты поиска:\n${searchContext}`);
      contextParts.push(`URL: ${url}`);
      const contextForAI = contextParts.join("\n\n");

      // Try Z-AI first
      try {
        const zai = createZAI();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Ты — эксперт по извлечению учебного контента из видео. На основе доступной информации (название, автор, результаты поиска) создай максимально подробное описание контента видео.

ВАЖНО: Строго придерживайся фактической информации. НЕ придумывай содержание, которого нет в результатах поиска.

Структура:
## Описание
[Подробное описание — основанное ТОЛЬКО на фактах]
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
              content: `Вот информация о видео:\n\n${contextForAI}\n\nСоздай подробное описание контента, основанное ТОЛЬКО на представленных данных.`
            }
          ],
        });
        transcript = completion.choices[0]?.message?.content || "";
        if (transcript.length > 50) transcriptSource = "ai_zai";
      } catch (err) {
        console.error("[Transcript] Z-AI failed:", err);
      }

      // Fallback: try OpenRouter/OpenAI
      if (!transcript || transcript.length < 50) {
        if (isAIConfigured()) {
          try {
            const fallback = await createChatCompletion([
              {
                role: "system",
                content: "Ты — эксперт по созданию описаний видео. На основе информации создай подробное описание на русском, строго по фактам. НЕ придумывай. Минимум 800 символов."
              },
              {
                role: "user",
                content: `Информация о видео:\n${contextForAI}\n\nСоздай описание по фактам.`
              }
            ], { temperature: 0.7 });
            transcript = fallback.choices?.[0]?.message?.content || "";
            if (transcript.length > 50) transcriptSource = "ai_fallback";
          } catch {}
        }
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
      source: transcriptSource,
      sources: {
        asr: transcriptSource === "asr",
        pipedDescription: transcriptSource === "piped_description",
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
