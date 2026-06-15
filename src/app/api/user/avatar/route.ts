import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

// ── Constants ──────────────────────────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_SIZE = 512; // px — resize to this square
const DEFAULT_AVATAR_BUCKET = "avatarsmyobuch";

// ── Avatar S3 config ───────────────────────────────────────────
// Avatars are stored in S3 and served through /api/avatars/ proxy.
// Selectel does NOT support public-read via S3 API, so we proxy
// all avatar reads through our Next.js server with authenticated S3 access.
//
// URL flow:
//   DB stores: /api/avatars/avatars/{userId}.webp
//   Browser → /api/avatars/avatars/{userId}.webp → S3 GetObject → image

function getAvatarS3Config() {
  const endpoint = process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru";
  const region = process.env.S3_REGION || "ru-7";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket =
    process.env.S3_AVATAR_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    DEFAULT_AVATAR_BUCKET;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "[Avatar S3] Missing S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY env vars."
    );
  }

  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

// Singleton S3Client for avatar uploads
const globalForAvatarS3 = globalThis as unknown as {
  avatarS3Client: S3Client | undefined;
  avatarS3Bucket: string | undefined;
};

function getAvatarS3Client(): { client: S3Client; bucket: string } {
  if (
    !globalForAvatarS3.avatarS3Client ||
    !globalForAvatarS3.avatarS3Bucket
  ) {
    const config = getAvatarS3Config();

    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Selectel uses path-style
    });

    globalForAvatarS3.avatarS3Client = client;
    globalForAvatarS3.avatarS3Bucket = config.bucket;
  }

  return {
    client: globalForAvatarS3.avatarS3Client,
    bucket: globalForAvatarS3.avatarS3Bucket,
  };
}

/**
 * Construct avatar URL that goes through our API proxy.
 * Format: /api/avatars/avatars/{userId}.webp
 * The /api/avatars/[...path] route will fetch from S3 with credentials.
 */
function getAvatarUrl(key: string): string {
  return `/api/avatars/${key}`;
}

/**
 * Extract S3 key from avatar URL.
 * Handles both /api/avatars/ URLs and legacy direct S3 URLs.
 */
function extractKeyFromAvatarUrl(url: string): string | null {
  try {
    // New format: /api/avatars/avatars/{userId}.webp
    if (url.startsWith("/api/avatars/")) {
      return url.slice("/api/avatars/".length);
    }

    // Legacy: https://s3.ru-7.storage.selcloud.ru/{bucket}/avatars/{userId}.webp
    const parsed = new URL(url);
    const bucket =
      process.env.S3_AVATAR_BUCKET_NAME ||
      process.env.S3_BUCKET_NAME ||
      DEFAULT_AVATAR_BUCKET;
    const prefix = `/${bucket}/`;
    if (parsed.pathname.startsWith(prefix)) {
      return decodeURIComponent(parsed.pathname.slice(prefix.length));
    }
    if (parsed.host.startsWith(bucket + ".")) {
      return decodeURIComponent(parsed.pathname.slice(1));
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const userId = session.user.id;

  // 2. Parse multipart form
  const formData = await request.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  // 3. Validate MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Неподдерживаемый формат. Допустимы: JPEG, PNG, WebP" },
      { status: 400 }
    );
  }

  // 4. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Файл слишком большой. Максимум 2 МБ" },
      { status: 400 }
    );
  }

  try {
    // 5. Get S3 client
    const { client, bucket } = getAvatarS3Client();

    // 6. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 7. Resize with sharp — center crop to AVATAR_SIZE x AVATAR_SIZE, convert to WebP
    const processedBuffer = await sharp(inputBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "center" })
      .webp({ quality: 85 })
      .toBuffer();

    // 8. S3 key: avatars/{userId}.webp (always webp after conversion)
    const key = `avatars/${userId}.webp`;

    // 9. Get current avatar URL to delete old file later
    const currentImageResult = await pool.query(
      `SELECT image FROM users WHERE id = $1`,
      [userId]
    );
    const currentImageUrl = currentImageResult.rows[0]?.image || null;

    // 10. Upload to S3 bucket
    console.log("[Avatar S3] Uploading:", { bucket, key, size: processedBuffer.length });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: "image/webp",
      })
    );

    // 11. Construct avatar URL (through API proxy)
    const avatarUrl = getAvatarUrl(key);
    console.log("[Avatar S3] Avatar URL:", avatarUrl);

    // 12. Update user image in DB
    await pool.query(`UPDATE users SET image = $1 WHERE id = $2`, [
      avatarUrl,
      userId,
    ]);

    // 13. Delete old avatar from S3 (if exists and different from new one)
    if (currentImageUrl && currentImageUrl !== avatarUrl) {
      try {
        const oldKey = extractKeyFromAvatarUrl(currentImageUrl);
        // Only delete if it's an avatar file (safety check)
        if (oldKey && oldKey.startsWith("avatars/")) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: oldKey,
            })
          );
          console.log("[Avatar S3] Deleted old avatar:", oldKey);
        }
      } catch (deleteErr) {
        // Non-critical: old file stays but doesn't break anything
        console.error("[Avatar S3] Failed to delete old avatar:", deleteErr);
      }
    }

    // 14. Return new URL with cache-bust param
    const cacheBustUrl = `${avatarUrl}?t=${Date.now()}`;

    return NextResponse.json({ url: cacheBustUrl }, { status: 200 });
  } catch (err: any) {
    console.error("[Avatar S3] Upload failed:", err?.message || err);

    const errorMessage =
      err?.message || "Ошибка при загрузке аватара";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
