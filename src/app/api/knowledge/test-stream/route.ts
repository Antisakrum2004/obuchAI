import { NextRequest, NextResponse } from "next/server";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";
import { Readable } from "stream";

const s3Provider = new S3StorageProvider();

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "knowledge/articles/CLAUDE CODE full ";
  const range = request.headers.get("Range") || undefined;

  try {
    const s3Stream = await s3Provider.streamObject(key, range);

    const responseHeaders = new Headers();
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Content-Type", s3Stream.contentType || "video/mp4");
    responseHeaders.set("Content-Length", String(s3Stream.contentLength));

    if (s3Stream.contentRange) {
      responseHeaders.set("Content-Range", s3Stream.contentRange);
    }

    responseHeaders.set("Cache-Control", "no-cache");

    // Convert Node.js Readable to Web ReadableStream
    const webStream = Readable.toWeb(s3Stream.body as Readable) as ReadableStream;

    return new Response(webStream, {
      status: s3Stream.statusCode,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[test-stream] Error:", error);
    return NextResponse.json(
      { error: "Stream failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
