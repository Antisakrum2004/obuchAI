import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import sharp from "sharp";

// ── Constants ──────────────────────────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_SIZE = 512; // px — resize to this square
const AVATAR_PREFIX = "avatars/";

// Singleton S3 provider (reuses existing client)
const s3 = new S3StorageProvider();

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
      { error: `Неподдерживаемый формат. Допустимы: JPEG, PNG, WebP` },
      { status: 400 }
    );
  }

  // 4. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Файл слишком большой. Максимум 2 МБ` },
      { status: 400 }
    );
  }

  try {
    // 5. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 6. Resize with sharp — center crop to AVATAR_SIZE x AVATAR_SIZE
    const processedBuffer = await sharp(inputBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "center" })
      .webp({ quality: 85 })
      .toBuffer();

    // 7. Determine file extension (always webp after conversion)
    const ext = "webp";
    const key = `${AVATAR_PREFIX}${userId}.${ext}`;

    // 8. Get current avatar URL to delete old file later
    const currentImageResult = await pool.query(
      `SELECT image FROM users WHERE id = $1`,
      [userId]
    );
    const currentImageUrl = currentImageResult.rows[0]?.image || null;

    // 9. Upload to S3 with public-read ACL so avatars are accessible via direct URL
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const s3Config = {
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION || "ru-7",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    };

    const bucket = process.env.S3_BUCKET_NAME!;
    const client = new S3Client(s3Config);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: "image/webp",
        ACL: "public-read", // Public access for avatars
      })
    );

    // 10. Construct public URL
    const publicUrl = `${process.env.S3_ENDPOINT}/${bucket}/${key}`;

    // 11. Update user image in DB
    await pool.query(
      `UPDATE users SET image = $1 WHERE id = $2`,
      [publicUrl, userId]
    );

    // 12. Delete old avatar from S3 (if exists and different from new one)
    if (currentImageUrl && currentImageUrl !== publicUrl) {
      try {
        const oldKey = s3.extractKeyFromUrl(currentImageUrl);
        // Only delete if it's an avatar file (safety check)
        if (oldKey.startsWith(AVATAR_PREFIX)) {
          await s3.delete(currentImageUrl);
        }
      } catch (deleteErr) {
        // Non-critical: old file stays but doesn't break anything
        console.error("[Avatar] Failed to delete old avatar:", deleteErr);
      }
    }

    // 13. Return new URL
    return NextResponse.json({ url: publicUrl }, { status: 200 });
  } catch (err) {
    console.error("[Avatar] Upload failed:", err);
    return NextResponse.json(
      { error: "Ошибка при загрузке аватара" },
      { status: 500 }
    );
  }
}
