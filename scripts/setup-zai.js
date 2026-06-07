#!/usr/bin/env node
/**
 * Generate .z-ai-config from environment variables.
 * This runs during Vercel build (postinstall) so the z-ai-web-dev-sdk
 * can find its config file even on serverless where /etc/.z-ai-config doesn't exist.
 */
const fs = require('fs');

if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
  const config = {
    baseUrl: process.env.ZAI_BASE_URL,
    apiKey: process.env.ZAI_API_KEY,
  };
  if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
  if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
  if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;

  fs.writeFileSync('.z-ai-config', JSON.stringify(config, null, 2));
  console.log('[setup-zai] .z-ai-config created from env vars');
} else {
  console.log('[setup-zai] ZAI env vars not set, skipping .z-ai-config generation');
}
