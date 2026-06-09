/**
 * ZAI SDK initialization utility.
 *
 * On Vercel (serverless), the .z-ai-config file doesn't exist at runtime,
 * so we bypass ZAI.create() and use the constructor directly with env vars.
 *
 * Required env vars:
 *   ZAI_BASE_URL — API base URL (e.g. https://internal-api.z.ai/v1)
 *   ZAI_API_KEY  — API key for authentication
 *
 * Optional env vars:
 *   ZAI_CHAT_ID  — Chat ID header
 *   ZAI_USER_ID  — User ID header
 *   ZAI_TOKEN    — Token header
 */

import ZAI from "z-ai-web-dev-sdk";

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let _cachedZai: ZAI | null = null;

/**
 * Check if ZAI SDK is configured (env vars present).
 * Does NOT throw — safe to call for pre-checks.
 */
export function isZAIConfigured(): boolean {
  return !!(process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY);
}

/**
 * Create a ZAI SDK instance from environment variables.
 * Caches the instance for reuse across requests.
 *
 * Throws a clear error if required env vars are missing.
 */
export function createZAI(): ZAI {
  if (_cachedZai) return _cachedZai;

  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "ZAI SDK не настроен. Добавьте ZAI_BASE_URL и ZAI_API_KEY в переменные окружения Vercel.\n" +
      "Подробнее: Settings → Environment Variables в Vercel Dashboard."
    );
  }

  const config: ZAIConfig = {
    baseUrl,
    apiKey,
    ...(process.env.ZAI_CHAT_ID && { chatId: process.env.ZAI_CHAT_ID }),
    ...(process.env.ZAI_USER_ID && { userId: process.env.ZAI_USER_ID }),
    ...(process.env.ZAI_TOKEN && { token: process.env.ZAI_TOKEN }),
  };

  console.log("[ZAI] Initializing from env vars, baseUrl:", baseUrl);

  // Use constructor directly — bypasses loadConfig() which reads .z-ai-config file
  _cachedZai = new (ZAI as unknown as new (cfg: ZAIConfig) => ZAI)(config);

  return _cachedZai;
}

/**
 * Reset cached instance (useful after env var changes or for testing).
 */
export function resetZAICache(): void {
  _cachedZai = null;
}
