import { NextResponse } from "next/server";
import { isAIConfigured, createChatCompletion, getAIConfig } from "@/lib/ai-provider";

// GET /api/knowledge/ai/debug — Diagnose AI provider connectivity (admin only)
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check config
  const config = getAIConfig();
  diagnostics.provider = config.provider;
  diagnostics.model = config.model;
  diagnostics.configured = config.configured;

  // 2. Check env vars (masked)
  const envVars: Record<string, string> = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
      ? `${process.env.OPENROUTER_API_KEY.substring(0, 10)}...`
      : "(not set)",
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "(default: google/gemini-2.5-flash-preview)",
  };
  diagnostics.envVars = envVars;

  if (!isAIConfigured()) {
    diagnostics.error = "OPENROUTER_API_KEY not set";
    return NextResponse.json(diagnostics);
  }

  // 3. Try a simple API call
  try {
    const completion = await createChatCompletion([
      { role: "user", content: "Reply with exactly: OK" }
    ]);
    diagnostics.apiCallSuccess = true;
    diagnostics.apiResponse = completion.choices?.[0]?.message?.content || "no content";
    diagnostics.modelUsed = completion.model || config.model;
  } catch (apiError: unknown) {
    diagnostics.apiCallSuccess = false;
    const err = apiError as Error;
    diagnostics.apiError = {
      message: err.message,
      name: err.name,
    };
  }

  return NextResponse.json(diagnostics);
}
