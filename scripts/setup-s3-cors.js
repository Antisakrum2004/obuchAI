#!/usr/bin/env node

/**
 * Установка CORS-правил на бакет Selectel S3 (JS-версия).
 *
 * Запуск:
 *   S3_ACCESS_KEY_ID=xxx S3_SECRET_ACCESS_KEY=yyy node scripts/setup-s3-cors.js
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

// ── Load .env files ──
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)="?(.*)"?$/);
    if (match) {
      const [, key, value] = match;
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim().replace(/^"|"$/g, "");
      }
    }
  }
}

loadEnvFile(path.resolve(__dirname, "..", ".env.local"));
loadEnvFile(path.resolve(__dirname, "..", ".env.development"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));

const endpoint = process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru";
const region = process.env.S3_REGION || "ru-7";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET_NAME || "ati-lab";

if (!accessKeyId || !secretAccessKey) {
  console.error("Error: Missing S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY");
  console.error("Usage: S3_ACCESS_KEY_ID=xxx S3_SECRET_ACCESS_KEY=yyy node scripts/setup-s3-cors.js");
  process.exit(1);
}

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
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  console.log(`Setting CORS on bucket: ${bucket} at ${endpoint}`);

  // Check existing
  try {
    const existing = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("Existing CORS:", JSON.stringify(existing.CORSRules, null, 2));
  } catch (err) {
    if (err.name === "NoSuchCORSConfiguration") {
      console.log("No existing CORS configuration.");
    } else {
      console.log("Could not read existing CORS:", err.message);
    }
  }

  // Apply new
  try {
    await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfiguration }));
    console.log("CORS configuration set successfully!");
    console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2));
  } catch (err) {
    console.error("Failed to set CORS:", err.message);
    if (err.message && err.message.includes("AccessDenied")) {
      console.error("The S3 keys do not have permission to manage bucket CORS. Check your credentials.");
    }
    process.exit(1);
  }
}

setupCORS().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
