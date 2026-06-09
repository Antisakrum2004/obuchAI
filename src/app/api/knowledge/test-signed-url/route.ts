import { NextRequest, NextResponse } from "next/server";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

const s3Provider = new S3StorageProvider();

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "knowledge/articles/CLAUDE CODE full ";

  try {
    // First resolve the key
    const resolved = await s3Provider.resolveKey(key);
    const actualKey = resolved?.key || key;

    const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);

    return NextResponse.json({
      originalKey: key,
      resolvedKey: actualKey,
      signedUrl: signedUrl,
      signedUrlLength: signedUrl.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
