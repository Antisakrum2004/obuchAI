/**
 * Временный API-роут для применения CORS-настроек к бакету Selectel S3.
 *
 * После деплоя на Vercel откройте в браузере:
 *   https://obuch-ai.vercel.app/api/admin/apply-cors
 *
 * После успешного выполнения УДАЛИТЕ этот файл — он не нужен в продакшене.
 */

import { NextResponse } from "next/server";
import {
  S3Client,
  PutBucketCorsCommand,
  S3ClientConfig,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── Конфигурация из env (те же переменные, что и в S3StorageProvider) ──
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "ru-7";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required env vars: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME",
          present: {
            S3_ENDPOINT: !!endpoint,
            S3_ACCESS_KEY_ID: !!accessKeyId,
            S3_SECRET_ACCESS_KEY: !!secretAccessKey,
            S3_BUCKET_NAME: !!bucket,
          },
        },
        { status: 500 }
      );
    }

    // ── Создаём S3Client (forcePathStyle — обязательно для Selectel) ──
    const clientConfig: S3ClientConfig = {
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    };

    const client = new S3Client(clientConfig);

    // ── CORS-правила ──
    // AllowedOrigins: продакшен + локальная разработка
    // AllowedMethods: GET и HEAD (для видео и предзагрузка)
    // AllowedHeaders: * (подписанные URL содержат свои заголовки)
    // ExposeHeaders: заголовки, которые браузер должен видеть для видео
    // MaxAgeSeconds: кэшируем preflight на 1 час
    const corsRules = [
      {
        AllowedOrigins: [
          "https://obuch-ai.vercel.app",
          "http://localhost:3000",
        ],
        AllowedMethods: ["GET", "HEAD"] as ("GET" | "PUT" | "POST" | "DELETE" | "PATCH")[],
        AllowedHeaders: ["*"],
        ExposeHeaders: [
          "Content-Length",
          "Content-Range",
          "Accept-Ranges",
          "Content-Type",
        ],
        MaxAgeSeconds: 3600,
      },
    ];

    console.log(`[CORS] Applying CORS rules to bucket "${bucket}"...`);
    console.log(`[CORS] Rules:`, JSON.stringify(corsRules, null, 2));

    const command = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await client.send(command);

    console.log(`[CORS] Successfully applied CORS rules to bucket "${bucket}"`);

    return NextResponse.json({
      success: true,
      message: `CORS applied successfully to bucket "${bucket}"`,
      bucket,
      rules: corsRules,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    const name =
      error instanceof Error ? error.constructor.name : "UnknownError";

    console.error(`[CORS] Failed to apply CORS:`, error);

    return NextResponse.json(
      {
        success: false,
        error: message,
        errorType: name,
      },
      { status: 500 }
    );
  }
}
