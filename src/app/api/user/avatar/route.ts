import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// ── Constants ──────────────────────────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_SIZE = 512; // px — resize to this square

// ── Avatar S3 config ───────────────────────────────────────────
// Avatars go to a SEPARATE public bucket (S3_AVATAR_BUCKET_NAME)
// so they are accessible via direct URL without signed URLs.
// Falls back to S3_BUCKET_NAME if the avatar-specific var is not set.

function getAvatarS3Config() {
  const endpoint = process.env.S3_ENDPOINT!;
  const region = process.env.S3_REGION || "ru-7";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;
  const bucket = process.env.S3_AVATAR_BUCKET_NAME || process.env.S3_BUCKET_NAME!;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("[Avatar S3] Missing required env vars");
  }

  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

// Singleton S3Client for avatar uploads
const globalForAvatarS3 = globalThis as unknown as {
  avatarS3Client: S3Client | undefined;
  avatarS3Bucket: string | undefined;
};

function getAvatarS3Client(): { client: S3Client; bucket: string } {
  if (!globalForAvatarS3.avatarS3Client || !globalForAvatarS3.avatarS3Bucket) {
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

    if (process.env.NODE_ENV !== "production") {
      globalForAvatarS3.avatarS3Client = client;
      globalForAvatarS3.avatarS3Bucket = config.bucket;
    }
  }

  return {
    client: globalForAvatarS3.avatarS3Client,
    bucket: globalForAvatarS3.avatarS3Bucket,
  };
}

/**
 * Construct public virtual-hosted URL for avatar.
 * Selectel supports virtual-hosted style: https://{bucket}.s3.ru-7.storage.selcloud.ru/{key}
 * This is the direct public URL — no signed URL needed.
 */
function getAvatarPublicUrl(bucket: string, key: string): string {
  const endpoint = new URL(process.env.S3_ENDPOINT!);
  // virtual-hosted style: bucket.host
  return `https://${bucket}.${endpoint.host}/${key}`;
}

/**
 * Extract key from avatar URL (handles both path-style and virtual-hosted style).
 */
function extractKeyFromAvatarUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    // Virtual-hosted style: bucket.s3.ru-7.storage.selcloud.ru/key
    if (parsed.host.startsWith(bucket + ".")) {
      return decodeURIComponent(parsed.pathname.slice(1)); // remove leading /
    }
    // Path-style: s3.ru-7.storage.selcloud.ru/bucket/key
    const prefix = `/${bucket}/`;
    if (parsed.pathname.startsWith(prefix)) {
      return decodeURIComponent(parsed.pathname.slice(prefix.length));
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
    // 5. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 6. Resize with sharp — center crop to AVATAR_SIZE x AVATAR_SIZE, convert to WebP
    const processedBuffer = await sharp(inputBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "center" })
      .webp({ quality: 85 })
      .toBuffer();

    // 7. S3 key: avatars/{userId}.webp (always webp after conversion)
    const key = `avatars/${userId}.webp`;

    // 8. Get current avatar URL to delete old file later
    const currentImageResult = await pool.query(
      `SELECT image FROM users WHERE id = $1`,
      [userId]
    );
    const currentImageUrl = currentImageResult.rows[0]?.image || null;

    // 9. Upload to avatar public bucket
    const { client, bucket } = getAvatarS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: "image/webp",
        ACL: "public-read", // Public access — avatars are accessible via direct URL
      })
    );

    // 10. Construct public URL (virtual-hosted style)
    const publicUrl = getAvatarPublicUrl(bucket, key);

    // 11. Update user image in DB
    await pool.query(
      `UPDATE users SET image = $1 WHERE id = $2`,
      [publicUrl, userId]
    );

    // 12. Delete old avatar from S3 (if exists and different from new one)
    if (currentImageUrl && currentImageUrl !== publicUrl) {
      try {
        const oldKey = extractKeyFromAvatarUrl(currentImageUrl, bucket);
        // Only delete if it's an avatar file in the avatar bucket (safety check)
        if (oldKey && oldKey.startsWith("avatars/")) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: oldKey,
            })
          );
        }
      } catch (deleteErr) {
        // Non-critical: old file stays but doesn't break anything
        console.error("[Avatar] Failed to delete old avatar:", deleteErr);
      }
    }

    // 13. Return new URL with cache-bust param
    const cacheBustUrl = `${publicUrl}?t=${Date.now()}`;

    return NextResponse.json({ url: cacheBustUrl }, { status: 200 });
  } catch (err) {
    console.error("[Avatar] Upload failed:", err);
    return NextResponse.json(
      { error: "Ошибка при загрузке аватара" },
      { status: 500 }
    );
  }
}
