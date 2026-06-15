import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";
import dns from "dns";

/**
 * Resolve HTTP redirect using native Node.js http/https module.
 *
 * Why not fetch (undici):
 *   Node.js fetch (undici) cannot reliably connect to downloader.disk.yandex.ru — ETIMEDOUT.
 *   The root cause: Node.js dns.lookup may resolve to IPv6 (2a02:6b8::2:127) which is
 *   unreachable from this server, while the IPv4 address (77.88.21.127) works fine.
 *   We force IPv4 via dns.lookup({ family: 4 }) and connect with the native https module.
 */
function resolveRedirect(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;

    // Force IPv4 — IPv6 address for downloader.disk.yandex.ru is unreachable
    dns.lookup(parsed.hostname, { family: 4 }, (dnsErr, ip) => {
      if (dnsErr) {
        reject(new Error(`DNS lookup failed: ${dnsErr.message}`));
        return;
      }

      const reqOptions: https.RequestOptions = {
        hostname: ip,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; bot)",
          "Range": "bytes=0-0",
          Host: parsed.hostname,
        },
      };

      // Set SNI for HTTPS so the TLS handshake uses the correct hostname
      if (isHttps) {
        reqOptions.servername = parsed.hostname;
      }

      const req = lib.request(reqOptions, (res) => {
        // Consume and discard the body to free the connection
        res.resume();

        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          const location = res.headers.location;
          if (location) {
            resolve(location);
          } else {
            reject(new Error(`Redirect ${status} but no Location header`));
          }
        } else if (status >= 200 && status < 300) {
          resolve(url);
        } else {
          reject(new Error(`Unexpected status ${status}`));
        }
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      });

      req.on("error", reject);
      req.end();
    });
  });
}

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
      // downloader.disk.yandex.ru returns 302 → storage.yandex.net (which has CORS: *).
      // We must resolve the redirect SERVER-SIDE because:
      //   - downloader.disk.yandex.ru returns 403 in the browser (Referer/cookie check)
      //   - storage.yandex.net works in <video> with Access-Control-Allow-Origin: *
      //
      // We use native Node.js https module instead of fetch (undici), because
      // undici cannot reliably connect to downloader.disk.yandex.ru (ETIMEDOUT).
      const storageUrl = await resolveRedirect(downloadData.href);
      if (storageUrl !== downloadData.href) {
        finalHref = storageUrl;
        console.log("[yandex-proxy] Followed redirect to storage URL:", storageUrl.substring(0, 80) + "...");
      } else {
        console.log("[yandex-proxy] No redirect, using original URL");
      }
    } catch (redirectErr) {
      // If redirect check fails, just use the original URL — might still work
      console.log("[yandex-proxy] Redirect follow failed, using original URL:", redirectErr);
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
