#!/usr/bin/env node

/**
 * Установка CORS-правил на бакет Selectel S3.
 *
 * Без этих правил браузер блокирует cross-origin запросы к видео из S3,
 * и <video src="signed-url"> получает CORS-ошибку вместо данных.
 *
 * Запуск:
 *   S3_ACCESS_KEY_ID=xxx S3_SECRET_ACCESS_KEY=xxx npx tsx scripts/set-cors.ts
 *   — или —
 *   node scripts/set-cors.js  (если ключи уже в .env)
 *
 * Правила:
 *   AllowedOrigins:  ['https://obuch-ai.vercel.app', 'http://localhost:3000']
 *   AllowedMethods:  ['GET', 'HEAD']
 *   AllowedHeaders:  ['*']
 *   ExposeHeaders:   ['Content-Length', 'Content-Range', 'Accept-Ranges']
 *   MaxAgeSeconds:   3600
 */

const {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require("@aws-sdk/client-s3");

const fs = require("fs");
const path = require("path");

// ── Load .env files ──────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)="?(.*)"?$/);
    if (match) {
      const [, key, value] = match;
      // Не перезаписываем уже установленные переменные (приоритет у env)
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim().replace(/^"|"$/g, "");
      }
    }
  }
}

// Загружаем .env файлы по приоритету
loadEnvFile(path.resolve(__dirname, "..", ".env.local"));
loadEnvFile(path.resolve(__dirname, "..", ".env.development"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));

// ── Configuration ────────────────────────────────────────────
const endpoint = process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru";
const region = process.env.S3_REGION || "ru-7";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET_NAME || "ati-lab";

if (!accessKeyId || !secretAccessKey) {
  console.error("❌ ОШИБКА: Не найдены S3 ключи!");
  console.error("");
  console.error("Передайте их через переменные окружения:");
  console.error("  S3_ACCESS_KEY_ID=xxx S3_SECRET_ACCESS_KEY=yyy npx tsx scripts/set-cors.ts");
  console.error("");
  console.error("Или создайте .env.local с переменными S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY");
  process.exit(1);
}

// ── CORS Configuration ───────────────────────────────────────
const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: [
        "https://obuch-ai.vercel.app",
        "http://localhost:3000",
      ],
      AllowedMethods: ["GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["Content-Length", "Content-Range", "Accept-Ranges"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function setupCORS() {
  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  console.log("═══════════════════════════════════════════════════");
  console.log("  Selectel S3 CORS Setup");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Endpoint:   ${endpoint}`);
  console.log(`  Region:     ${region}`);
  console.log(`  Bucket:     ${bucket}`);
  console.log(`  AccessKey:  ${accessKeyId.substring(0, 8)}...`);
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // 1. Check existing CORS
  try {
    const existing = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("📋 Текущие CORS-правила:");
    console.log(JSON.stringify(existing.CORSRules, null, 2));
    console.log();
  } catch (err: any) {
    if (err.name === "NoSuchCORSConfiguration" || err.Code === "NoSuchCORSConfiguration") {
      console.log("📋 CORS-правила ещё не настроены (пусто).");
    } else {
      console.log("⚠️  Не удалось прочитать текущие CORS:", err.message || err.Code || err);
    }
    console.log();
  }

  // 2. Apply new CORS
  console.log("🔧 Применяем новые CORS-правила...");
  console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2));
  console.log();

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: corsConfiguration,
      })
    );
    console.log("✅ CORS-правила успешно установлены!");
    console.log();
    console.log("Теперь браузер сможет напрямую качать видео из Selectel по signed URL.");
    console.log("Проверка: откройте видео на https://obuch-ai.vercel.app");
  } catch (err: any) {
    console.error("❌ Ошибка при установке CORS:", err.message || err.Code || err);
    console.error();
    if (err.message && (err.message.includes("AccessDenied") || err.message.includes("403"))) {
      console.error("🚨 СМЫСЛ ОШИБКИ: Указанные S3-ключи не имеют права управлять CORS бакета.");
      console.error("   Возможные причины:");
      console.error("   1. Ключи readonly — нужны ключи с правами s3:PutBucketCORS");
      console.error("   2. Неправильный Access Key / Secret Key");
      console.error("   3. Ключ от другого проекта/тенанта");
    }
    process.exit(1);
  }
}

setupCORS().catch((err) => {
  console.error("Непредвиденная ошибка:", err);
  process.exit(1);
});
