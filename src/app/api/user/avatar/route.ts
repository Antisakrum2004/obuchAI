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
// Avatars go to a SEPARATE public bucket (S3_AVATAR_BUCKET_NAME)
// so they are accessible via direct URL without signed URLs.
// Falls back to S3_BUCKET_NAME if the avatar-specific var is not set.
// If nothing is set, uses DEFAULT_AVATAR_BUCKET.
//
// IMPORTANT: Selectel does NOT support public-read via S3 API
// (neither ACL nor BucketPolicy works — BucketPolicy even BREAKS PutObject).
// Public access must be enabled manually in the Selectel Control Panel:
// my.selectel.ru → Cloud Storage → Container → Enable "Public access"

function getAvatarS3Config() {
  const endpoint = process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru";
  const region = process.env.S3_REGION || "ru-7";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket =
    process.env.S3_AVATAR_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    DEFAULT_AVATAR_BUCKET;

  // Log current env state for diagnostics
  console.log("[Avatar S3] Config:", {
    endpoint,
    region,
    bucket,
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    S3_AVATAR_BUCKET_NAME: process.env.S3_AVATAR_BUCKET_NAME || "(not set)",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || "(not set)",
  });

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "[Avatar S3] Missing S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY env vars. " +
      "Current env: S3_ENDPOINT=" + endpoint + ", S3_AVATAR_BUCKET_NAME=" +
      (process.env.S3_AVATAR_BUCKET_NAME || "(not set)") + ", S3_BUCKET_NAME=" +
      (process.env.S3_BUCKET_NAME || "(not set)")
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
 * Construct public PATH-STYLE URL for avatar.
 * Selectel path-style: https://s3.ru-7.storage.selcloud.ru/{bucket}/{key}
 * This is the direct public URL — requires public access enabled in Selectel panel.
 */
function getAvatarPublicUrl(bucket: string, key: string): string {
  const endpoint = process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru";
  // Remove trailing slash
  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  // Path-style: endpoint/bucket/key
  return `${cleanEndpoint}/${bucket}/${key}`;
}

/**
 * Extract key from avatar URL (handles path-style).
 */
function extractKeyFromAvatarUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    // Path-style: s3.ru-7.storage.selcloud.ru/bucket/key
    const prefix = `/${bucket}/`;
    if (parsed.pathname.startsWith(prefix)) {
      return decodeURIComponent(parsed.pathname.slice(prefix.length));
    }
    // Virtual-hosted style fallback: bucket.s3.ru-7.storage.selcloud.ru/key
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
    // 5. Get S3 client (with auto-diagnostics)
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

    // 10. Upload to avatar public bucket
    console.log("[Avatar S3] Uploading:", { bucket, key, size: processedBuffer.length });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: "image/webp",
      })
    );

    // 11. Construct public URL (path-style)
    const publicUrl = getAvatarPublicUrl(bucket, key);
    console.log("[Avatar S3] Public URL:", publicUrl);

    // 12. Update user image in DB
    await pool.query(`UPDATE users SET image = $1 WHERE id = $2`, [
      publicUrl,
      userId,
    ]);

    // 13. Delete old avatar from S3 (if exists and different from new one)
    if (currentImageUrl && currentImageUrl !== publicUrl) {
      try {
        const oldKey = extractKeyFromAvatarUrl(currentImageUrl, bucket);
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
    const cacheBustUrl = `${publicUrl}?t=${Date.now()}`;

    return NextResponse.json({ url: cacheBustUrl }, { status: 200 });
  } catch (err: any) {
    console.error("[Avatar S3] Upload failed:", err?.message || err);

    // Return detailed error for diagnostics
    const errorMessage =
      err?.message || "Ошибка при загрузке аватара";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
