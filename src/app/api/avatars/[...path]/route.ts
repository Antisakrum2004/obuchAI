import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// ── Avatar S3 Proxy ────────────────────────────────────────────
// Serves avatar images from S3 without requiring public bucket access.
// Selectel does not support public-read via S3 API (ACL/BucketPolicy),
// so we proxy requests through our server using authenticated S3 reads.
//
// URL format: /api/avatars/avatars/{userId}.webp
// Maps to S3: s3.ru-7.storage.selcloud.ru/{bucket}/avatars/{userId}.webp

const DEFAULT_AVATAR_BUCKET = "avatarsmyobuch";

// Singleton S3 client
const globalForAvatarProxy = globalThis as unknown as {
  avatarProxyClient: S3Client | undefined;
};

function getS3Client(): S3Client {
  if (!globalForAvatarProxy.avatarProxyClient) {
    globalForAvatarProxy.avatarProxyClient = new S3Client({
      region: process.env.S3_REGION || "ru-7",
      endpoint: process.env.S3_ENDPOINT || "https://s3.ru-7.storage.selcloud.ru",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return globalForAvatarProxy.avatarProxyClient;
}

function getAvatarBucket(): string {
  return (
    process.env.S3_AVATAR_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    DEFAULT_AVATAR_BUCKET
  );
}

// Cache control: avatars change rarely, cache for 1 hour on CDN
const CACHE_MAX_AGE = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Build S3 key from path segments: ["avatars", "userId.webp"] → "avatars/userId.webp"
  const key = path.join("/");

  // Safety: only allow avatars/ prefix
  if (!key.startsWith("avatars/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Safety: only allow .webp files
  if (!key.endsWith(".webp")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const client = getS3Client();
    const bucket = getAvatarBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Convert stream to buffer
    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);

    // Return image with cache headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=86400`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    // S3 NoSuchKey → 404, everything else → 404 too (don't leak S3 errors)
    console.error("[Avatar Proxy] Error:", key, err?.Code || err?.message);

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
