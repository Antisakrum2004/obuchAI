#!/usr/bin/env node

/**
 * Setup CORS configuration on the Selectel S3 bucket.
 *
 * This script configures Cross-Origin Resource Sharing (CORS) rules
 * on the S3 bucket to allow cross-origin requests from the application.
 *
 * NOTE: With the streaming proxy implementation, the browser no longer
 * connects to S3 directly (the server proxies all video requests).
 * However, this CORS configuration is still useful for:
 * - Backward compatibility with the ?format=json signed URL approach
 * - Direct file downloads if needed in the future
 * - Development/testing scenarios
 *
 * Usage:
 *   node scripts/setup-s3-cors.js
 *
 * Required environment variables (from .env):
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");

// ── Load environment variables from .env ──────────────────────
function loadEnv() {
  const fs = require("fs");
  const path = require("path");

  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env file not found at", envPath);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)="?(.*)"?$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim().replace(/^"|"$/g, "");
    }
  }
}

loadEnv();

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "ru-7";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET_NAME;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Error: Missing required S3 environment variables.");
  console.error("Required: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME");
  process.exit(1);
}

// ── CORS Configuration ────────────────────────────────────────

const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: [
        "https://obuch-ai.vercel.app",
        "http://localhost:3000",
      ],
      AllowedMethods: ["GET"],
      AllowedHeaders: ["Range", "Content-Type"],
      ExposeHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
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

  console.log(`Setting CORS on bucket: ${bucket}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Allowed origins: ${corsConfiguration.CORSRules[0].AllowedOrigins.join(", ")}`);
  console.log();

  // First, check existing CORS configuration
  try {
    const existing = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("Existing CORS configuration:");
    console.log(JSON.stringify(existing.CORSRules, null, 2));
    console.log();
  } catch (err) {
    if (err.name === "NoSuchCORSConfiguration") {
      console.log("No existing CORS configuration found.");
    } else {
      console.log("Could not read existing CORS (may not exist):", err.message);
    }
    console.log();
  }

  // Apply new CORS configuration
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: corsConfiguration,
      })
    );
    console.log("✓ CORS configuration set successfully!");
    console.log();
    console.log("Configuration applied:");
    console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2));
  } catch (err) {
    console.error("✗ Failed to set CORS configuration:", err.message);
    process.exit(1);
  }
}

setupCORS().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
