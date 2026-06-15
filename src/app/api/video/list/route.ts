import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/video/list
 *
 * Reads the file listing from the local media server (Serveo tunnel)
 * and returns a JSON array of .mp4 file names.
 *
 * The media server serves a simple "Index of /" HTML page with links
 * to all files. We parse it with a regex to extract .mp4 filenames.
 *
 * Returns: { files: string[] }
 */
export async function GET() {
  const serverUrl = process.env.MEDIA_SERVER_URL;

  if (!serverUrl) {
    console.warn("[video/list] MEDIA_SERVER_URL is not set");
    return NextResponse.json({ files: [] });
  }

  try {
    const res = await fetch(serverUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; obuchai-bot)",
      },
    });

    if (!res.ok) {
      console.error("[video/list] Media server returned", res.status);
      return NextResponse.json({ files: [] });
    }

    const html = await res.text();

    // Parse href="filename.mp4" from directory listing HTML
    const regex = /href="([^"]+\.mp4)"/gi;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const raw = match[1];
      try {
        const decoded = decodeURIComponent(raw);
        // Strip leading "./" or "/" — keep only filename
        const fileName = decoded.replace(/^\.\//, "").replace(/^\//, "");
        seen.add(fileName);
      } catch {
        // If decode fails, use raw value
        seen.add(raw);
      }
    }

    const files = Array.from(seen).sort();

    console.log(`[video/list] Found ${files.length} video file(s)`);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("[video/list] Error fetching media server:", err instanceof Error ? err.message : err);
    return NextResponse.json({ files: [] });
  }
}
