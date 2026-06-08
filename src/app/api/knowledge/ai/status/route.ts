import { NextResponse } from "next/server";
import { isZAIConfigured } from "@/lib/zai";

// GET /api/knowledge/ai/status — Check if AI processing is available
export async function GET() {
  const configured = isZAIConfigured();

  return NextResponse.json({
    available: configured,
    message: configured
      ? "AI-сервис настроен и готов к работе"
      : "AI-сервис не настроен. Добавьте ZAI_BASE_URL и ZAI_API_KEY в переменные окружения Vercel.",
  });
}
