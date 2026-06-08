/**
 * AI Provider — OpenRouter (OpenAI-compatible API)
 *
 * Uses OpenRouter to access models like Gemini Flash, GPT-4, etc.
 * API is OpenAI-compatible: https://openrouter.ai/api/v1/chat/completions
 *
 * Required env vars:
 *   OPENROUTER_API_KEY — API key from openrouter.ai
 *
 * Optional env vars:
 *   OPENROUTER_MODEL — Model to use (default: google/gemini-2.5-flash-preview)
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string; role: string };
    finish_reason: string;
    index: number;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
  id?: string;
}

const DEFAULT_MODEL = "google/gemini-2.5-flash-preview";
const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Check if OpenRouter is configured (env var present).
 */
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Check if ANY AI provider is configured.
 */
export function isAIConfigured(): boolean {
  return isOpenRouterConfigured();
}

/**
 * Get the model name from env or default.
 */
function getModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

/**
 * Create a chat completion via OpenRouter.
 * OpenRouter is OpenAI-compatible, so we use the standard format.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter API не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения Vercel."
    );
  }

  const body = {
    model: getModel(),
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.max_tokens ?? 4096,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://obuch-ai.vercel.app",
      "X-Title": "ObuchAI — Educational Platform",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  return (await response.json()) as ChatCompletionResponse;
}

/**
 * Get AI configuration info for debugging.
 */
export function getAIConfig(): { provider: string; model: string; configured: boolean } {
  return {
    provider: "openrouter",
    model: getModel(),
    configured: isOpenRouterConfigured(),
  };
}
