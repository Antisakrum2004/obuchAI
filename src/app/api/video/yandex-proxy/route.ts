import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/video/yandex-proxy
 *
 * Resolves a Yandex Disk public link to a direct .mp4 download URL.
 * This is needed because:
 *   1. Yandex Disk sets X-Frame-Options: SAMEORIGIN — iframe embedding is blocked
 *   2. The public API returns a temporary direct download URL that works with <video>
 *   3. CORS is allowed (Access-Control-Allow-Origin: *) on the download URL
 *
 * Query params:
 *   - url: Yandex Disk public link (e.g. https://disk.yandex.ru/d/XXX or /i/XXX)
 *
 * Returns:
 *   { href: string, name: string, type: string, size: number, preview?: string }
 *   or { error: string }
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  // Validate it's a Yandex Disk URL
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("disk.yandex") && !parsed.hostname.includes("yadi.sk")) {
      return NextResponse.json({ error: "Not a Yandex Disk URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Step 1: Get file metadata (name, size, preview)
    const metaUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(url)}`;
    const metaRes = await fetch(metaUrl, { headers: { "Accept": "application/json" } });

    let name = "video.mp4";
    let type = "video/mp4";
    let size = 0;
    let preview: string | undefined;

    if (metaRes.ok) {
      const meta = await metaRes.json();
      name = meta.name || name;
      type = meta.mime_type || type;
      size = meta.size || 0;
      preview = meta.preview || undefined;
    }

    // Step 2: Get direct download URL
    const downloadUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
    const downloadRes = await fetch(downloadUrl, { headers: { "Accept": "application/json" } });

    if (!downloadRes.ok) {
      const errText = await downloadRes.text();
      console.error("[yandex-proxy] Download API error:", downloadRes.status, errText);
      return NextResponse.json(
        { error: `Yandex API returned ${downloadRes.status}` },
        { status: 502 }
      );
    }

    const downloadData = await downloadRes.json();

    if (!downloadData.href) {
      return NextResponse.json({ error: "No download URL in response" }, { status: 502 });
    }

    return NextResponse.json({
      href: downloadData.href,
      name,
      type,
      size,
      preview,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[yandex-proxy] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
