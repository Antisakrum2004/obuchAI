import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/knowledge/video/resolve
 * Resolves a Yandex Disk public URL to a direct streaming URL
 * that can be used as the src of an HTML5 <video> element.
 *
 * Uses Yandex Disk Public API (no auth required for public links):
 * GET https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    // Only allow Yandex Disk URLs
    const hostname = new URL(url).hostname.toLowerCase();
    if (!hostname.includes("disk.yandex") && !hostname.includes("yandex")) {
      return NextResponse.json(
        { error: "Only Yandex Disk URLs are supported" },
        { status: 400 }
      );
    }

    // Resolve via Yandex Disk Public API
    const resolveUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;

    const response = await fetch(resolveUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      // Short timeout to avoid hanging on serverless
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[video/resolve] Yandex API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to resolve Yandex Disk URL", details: `HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data.href) {
      return NextResponse.json(
        { error: "No download link returned from Yandex Disk" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      directUrl: data.href,
      method: data.method || "GET",
      // Yandex Disk temporary links expire — tell the client to cache briefly
      expiresIn: 3600,
    });
  } catch (err) {
    console.error("[video/resolve] Error:", err);
    return NextResponse.json(
      { error: "Failed to resolve video URL" },
      { status: 500 }
    );
  }
}
