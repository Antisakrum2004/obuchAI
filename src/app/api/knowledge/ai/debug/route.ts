import { NextResponse } from "next/server";
import { isZAIConfigured, createZAI, resetZAICache } from "@/lib/zai";

// GET /api/knowledge/ai/debug — Diagnose ZAI SDK connectivity (admin only)
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check env vars
  const envVars: Record<string, string> = {
    ZAI_BASE_URL: process.env.ZAI_BASE_URL || "(not set)",
    ZAI_API_KEY: process.env.ZAI_API_KEY ? `${process.env.ZAI_API_KEY.substring(0, 6)}...` : "(not set)",
    ZAI_TOKEN: process.env.ZAI_TOKEN ? `${process.env.ZAI_TOKEN.substring(0, 10)}...` : "(not set)",
    ZAI_CHAT_ID: process.env.ZAI_CHAT_ID || "(not set)",
    ZAI_USER_ID: process.env.ZAI_USER_ID || "(not set)",
  };
  diagnostics.envVars = envVars;
  diagnostics.isConfigured = isZAIConfigured();

  if (!isZAIConfigured()) {
    diagnostics.error = "ZAI env vars not configured";
    return NextResponse.json(diagnostics);
  }

  // 2. Reset cached instance (force fresh creation)
  resetZAICache();

  // 3. Try to create ZAI instance
  try {
    const zai = createZAI();
    diagnostics.instanceCreated = true;

    // 4. Try a simple API call
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "user", content: "Reply with exactly: OK" }
        ],
      });
      diagnostics.apiCallSuccess = true;
      diagnostics.apiResponse = completion.choices?.[0]?.message?.content || "no content";
    } catch (apiError: unknown) {
      diagnostics.apiCallSuccess = false;
      const err = apiError as Error;
      diagnostics.apiError = {
        message: err.message,
        name: err.name,
        cause: err.cause ? String(err.cause) : undefined,
        stack: err.stack?.split("\n").slice(0, 3),
      };
    }
  } catch (createError: unknown) {
    diagnostics.instanceCreated = false;
    const err = createError as Error;
    diagnostics.createError = err.message;
  }

  return NextResponse.json(diagnostics);
}
