import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/video/yandex-proxy
 *
 * Resolves a Yandex Disk public link to a DIRECT video URL that works in <video>.
 *
 * Why this is needed:
 *   1. Yandex Disk sets X-Frame-Options: SAMEORIGIN — iframe embedding is blocked
 *   2. The Yandex public API returns a download URL on downloader.disk.yandex.ru
 *   3. BUT downloader.disk.yandex.ru returns 403 in the browser (checks Referer/cookies)
 *   4. SOLUTION: We follow the redirect server-side and return the FINAL storage URL
 *      (e.g. s1101sas.storage.yandex.net) which has CORS=* and works in <video>
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
    const metaRes = await fetch(metaUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

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

    // Step 2: Get download URL from Yandex API
    const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
    const downloadRes = await fetch(downloadApiUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

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

    // Step 3: CRITICAL — Follow the redirect to get the FINAL storage URL
    //
    // The URL from the API points to downloader.disk.yandex.ru which returns 302 → storage.yandex.net
    // BUT downloader.disk.yandex.ru blocks browser requests (403) due to Referer/cookie checks.
    // We follow the redirect HERE on the server and return the FINAL URL (storage.yandex.net)
    // which has Access-Control-Allow-Origin: * and works in <video> elements.
    let finalHref = downloadData.href;

    try {
      const redirectCheck = await fetch(downloadData.href, {
        method: "HEAD",
        redirect: "manual", // Don't auto-follow — we want to get the Location header
        signal: AbortSignal.timeout(10000),
        headers: {
          // Don't send Referer — Yandex may block based on it
        },
      });

      // If it's a redirect (302), extract the final URL from Location header
      if (redirectCheck.status === 301 || redirectCheck.status === 302 || redirectCheck.status === 303 || redirectCheck.status === 307 || redirectCheck.status === 308) {
        const location = redirectCheck.headers.get("location");
        if (location) {
          finalHref = location;
          console.log("[yandex-proxy] Followed redirect to storage URL:", location.substring(0, 80) + "...");
        }
      } else if (redirectCheck.ok) {
        // No redirect needed — URL works directly
        console.log("[yandex-proxy] Direct URL works (status 200)");
      }
    } catch (redirectErr) {
      // If redirect check fails, just use the original URL — might still work
      console.log("[yandex-proxy] Redirect check failed, using original URL:", redirectErr);
    }

    return NextResponse.json({
      href: finalHref,
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
