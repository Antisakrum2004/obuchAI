import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createZAI, isZAIConfigured } from "@/lib/zai";
import { createChatCompletion, isAIConfigured } from "@/lib/ai-provider";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/playground/chat
 *
 * Playground AI chat endpoint — sends user's prompt to AI
 * and returns the response. Rate-limited to prevent abuse.
 * Tries Z-AI SDK first, falls back to OpenRouter/OpenAI.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Rate limit: 10 playground requests per minute per user
    const rateResult = checkRateLimit(`playground:${session.user.id}`, RATE_LIMITS.ai);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов. Подождите немного." },
        { status: 429 }
      );
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Нет сообщений" }, { status: 400 });
    }

    // Limit context length
    const trimmedMessages = messages.slice(-10);

    const systemMessage = {
      role: "system" as const,
      content: `Ты — AI-ассистент для 1С-разработчиков, помогающий практиковаться в написании промптов.
Отвечай на русском языке. Давай конкретные, практические ответы.
Если пользователь просит помочь с промптом — покажи улучшенную версию и объясни, почему она лучше.
Если пользователь пишет код 1С — проверь его на типичные ошибки и предложи улучшения.`,
    };

    let content: string | null = null;

    // Try Z-AI SDK first
    if (isZAIConfigured()) {
      try {
        const zai = createZAI();
        const completion = await zai.chat.completions.create({
          messages: [systemMessage, ...trimmedMessages],
          temperature: 0.7,
          max_tokens: 1500,
        });
        content = completion.choices?.[0]?.message?.content || null;
      } catch (zaiErr) {
        console.warn("[Playground Chat] Z-AI failed, falling back to OpenRouter:", zaiErr);
      }
    }

    // Fallback to OpenRouter/OpenAI
    if (!content && isAIConfigured()) {
      try {
        const allMessages = [systemMessage, ...trimmedMessages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))];
        const result = await createChatCompletion(allMessages, { temperature: 0.7, max_tokens: 1500 });
        content = result.choices?.[0]?.message?.content || null;
      } catch (aiErr) {
        console.warn("[Playground Chat] OpenRouter failed:", aiErr);
      }
    }

    if (!content) {
      return NextResponse.json({ error: "AI сервис недоступен. Проверьте настройки API." }, { status: 503 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("[Playground Chat] Error:", error);
    return NextResponse.json(
      { error: "Ошибка AI сервиса. Попробуйте позже." },
      { status: 500 }
    );
  }
}
