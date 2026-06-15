import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/video/stream?file=filename.mp4
 *
 * Proxies video streaming from the local media server (Serveo tunnel)
 * to the client browser. This is needed because:
 *   - The media server URL may not have CORS headers
 *   - We want to avoid exposing the internal server URL to the client
 *   - Range requests (byte serving) are forwarded for seeking support
 *
 * Supports HTTP Range requests for video seeking.
 */
export async function GET(request: NextRequest) {
  const fileName = request.nextUrl.searchParams.get("file");

  if (!fileName) {
    return NextResponse.json({ error: "Missing 'file' parameter" }, { status: 400 });
  }

  // Security: prevent path traversal
  if (fileName.includes("..") || fileName.startsWith("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const serverUrl = process.env.MEDIA_SERVER_URL;
  if (!serverUrl) {
    return NextResponse.json({ error: "Media server not configured" }, { status: 503 });
  }

  const videoUrl = `${serverUrl}/${encodeURIComponent(fileName)}`;

  try {
    // Forward Range header for seeking support
    const rangeHeader = request.headers.get("range");
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; obuchai-bot)",
    };
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const upstreamRes = await fetch(videoUrl, {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.error("[video/stream] Upstream error:", upstreamRes.status, fileName);
      return NextResponse.json({ error: `Video file not found: ${fileName}` }, { status: 404 });
    }

    // Build response headers
    const responseHeaders = new Headers();

    // Forward content type
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("Content-Type", contentType);
    } else {
      responseHeaders.set("Content-Type", "video/mp4");
    }

    // Forward content length
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // Forward content range for partial responses
    if (upstreamRes.status === 206) {
      const contentRange = upstreamRes.headers.get("content-range");
      if (contentRange) {
        responseHeaders.set("Content-Range", contentRange);
      }
      responseHeaders.set("Status", "206");
    }

    // Accept Range requests
    responseHeaders.set("Accept-Ranges", "bytes");

    // Allow CORS for video element
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[video/stream] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  }
}
