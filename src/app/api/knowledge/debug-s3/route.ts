import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const s3Provider = new S3StorageProvider();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // Temporarily allow unauthenticated access for debugging — REMOVE AFTER FIX
    // if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
    //   return NextResponse.json({ error: "Admin only" }, { status: 403 });
    // }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("articleId");

    const results: Record<string, unknown> = {};

    // 1. Get article from DB
    if (articleId) {
      const articleResult = await pool.query(
        `SELECT id, title, "videoUrl" FROM articles WHERE id = $1`,
        [articleId]
      );
      if (articleResult.rows.length > 0) {
        results.article = articleResult.rows[0];
      }
    }

    // 2. List ALL objects under knowledge/articles/
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME } = process.env;

    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET_NAME) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
    }

    const client = new S3Client({
      region: S3_REGION || "ru-7",
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    // List objects
    const listResult = await client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: "knowledge/articles/",
      MaxKeys: 100,
    }));

    results.objects = (listResult.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString(),
    }));

    // 3. Test resolveKey for specific article
    if (articleId && results.article) {
      const videoUrl = (results.article as Record<string, unknown>).videoUrl as string;
      if (videoUrl) {
        // Extract S3 key
        let s3Key: string | null = null;
        if (videoUrl.startsWith("s3://")) {
          const withoutProtocol = videoUrl.slice(5);
          const slashIndex = withoutProtocol.indexOf("/");
          if (slashIndex > 0) s3Key = withoutProtocol.slice(slashIndex + 1);
        } else if (videoUrl.startsWith("http")) {
          const prefix = `${S3_ENDPOINT}/${S3_BUCKET_NAME}/`;
          if (videoUrl.startsWith(prefix)) s3Key = videoUrl.slice(prefix.length);
        } else {
          s3Key = videoUrl;
        }

        results.extractedKey = s3Key;
        results.extractedKeyRepr = JSON.stringify(s3Key);

        if (s3Key) {
          // Try resolveKey
          const resolved = await s3Provider.resolveKey(s3Key);
          results.resolveKeyResult = resolved;

          // Try HeadObject variations
          const headTests: Record<string, unknown> = {};

          for (const testKey of [s3Key, s3Key.trim(), s3Key.trim() + ".mp4"]) {
            try {
              const head = await client.send(new HeadObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: testKey,
              }));
              headTests[testKey] = { found: true, size: head.ContentLength, contentType: head.ContentType };
            } catch {
              headTests[testKey] = { found: false };
            }
          }
          results.headTests = headTests;

          // Try GetObject with small Range
          if (resolved) {
            try {
              const getObj = await client.send(new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: resolved.key,
                Range: "bytes=0-1023",
              }));
              results.sdkRangeTest = {
                success: true,
                status: getObj.$metadata.httpStatusCode,
                contentLength: getObj.ContentLength,
                contentRange: getObj.ContentRange,
                contentType: getObj.ContentType,
              };
            } catch (e: unknown) {
              results.sdkRangeTest = {
                success: false,
                error: e instanceof Error ? e.message : String(e),
              };
            }
          }
        }
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("[debug-s3] Error:", error);
    return NextResponse.json(
      { error: "Debug failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
