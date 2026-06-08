import { NextResponse } from "next/server";
import { isAIConfigured, getAIConfig } from "@/lib/ai-provider";

// GET /api/knowledge/ai/status — Check if AI processing is available
export async function GET() {
  const configured = isAIConfigured();
  const config = getAIConfig();

  return NextResponse.json({
    available: configured,
    provider: config.provider,
    model: config.model,
    message: configured
      ? `AI-сервис настроен (${config.provider}, модель: ${config.model})`
      : "AI-сервис не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения Vercel.",
  });
}
