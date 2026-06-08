/**
 * AI Provider — OpenAI API (compatible with OpenRouter)
 *
 * Supports both OpenAI API and OpenRouter (OpenAI-compatible).
 * Auto-detects which provider to use based on the key format:
 *   sk-proj-*  → OpenAI API (api.openai.com)
 *   sk-or-*    → OpenRouter (openrouter.ai)
 *
 * Required env vars:
 *   OPENROUTER_API_KEY — API key from OpenAI or OpenRouter
 *
 * Optional env vars:
 *   OPENROUTER_MODEL — Model to use
 *     OpenAI default: gpt-4o-mini
 *     OpenRouter default: google/gemini-2.5-flash-preview
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

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-preview";

/**
 * Detect provider based on API key format.
 */
function detectProvider(apiKey: string): { baseUrl: string; defaultModel: string; provider: string } {
  if (apiKey.startsWith("sk-or-")) {
    return { baseUrl: OPENROUTER_BASE_URL, defaultModel: OPENROUTER_DEFAULT_MODEL, provider: "openrouter" };
  }
  // sk-proj-*, sk-*, etc. → OpenAI
  return { baseUrl: OPENAI_BASE_URL, defaultModel: OPENAI_DEFAULT_MODEL, provider: "openai" };
}

/**
 * Check if AI is configured (env var present).
 */
export function isAIConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Get the model name from env or default.
 */
function getModel(): string {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const detected = detectProvider(apiKey);
  return process.env.OPENROUTER_MODEL || detected.defaultModel;
}

/**
 * Get AI configuration info for debugging.
 */
export function getAIConfig(): { provider: string; model: string; configured: boolean } {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const detected = detectProvider(apiKey);
  return {
    provider: detected.provider,
    model: getModel(),
    configured: !!apiKey,
  };
}

/**
 * Create a chat completion via OpenAI or OpenRouter.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI API не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения Vercel."
    );
  }

  const detected = detectProvider(apiKey);
  const model = getModel();

  const body = {
    model,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.max_tokens ?? 4096,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter-specific headers
  if (detected.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://obuch-ai.vercel.app";
    headers["X-Title"] = "ObuchAI";
  }

  console.log(`[AI] Calling ${detected.provider} (${model}), messages: ${messages.length}`);

  const response = await fetch(`${detected.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${detected.provider} API error (${response.status}): ${errorText}`
    );
  }

  const result = (await response.json()) as ChatCompletionResponse;
  console.log(`[AI] Response OK, model: ${result.model}, usage: ${JSON.stringify(result.usage)}`);
  return result;
}
