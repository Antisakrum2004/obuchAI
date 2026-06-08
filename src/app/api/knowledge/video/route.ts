import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/knowledge/video/resolve
 * Resolves a Yandex Disk public URL to a direct streaming URL
 * that can be used as the src of an HTML5 <video> element.
 *
 * Uses Yandex Disk Public API (no auth required for public links):
 * GET https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=URL
 *
 * Important: The Yandex Disk link MUST be a public share link (created via "Share" button).
 * Links to folders or private files will return 404.
 *
 * Supported URL formats:
 * - https://disk.yandex.ru/d/XXXX  (file share link)
 * - https://disk.yandex.ru/i/XXXX  (file share link, new format)
 * - https://yadi.sk/d/XXXX         (short share link)
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

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Only allow Yandex Disk URLs
    if (!hostname.includes("disk.yandex") && !hostname.includes("yandex") && !hostname.includes("yadi.sk")) {
      return NextResponse.json(
        { error: "Only Yandex Disk URLs are supported" },
        { status: 400 }
      );
    }

    // Step 1: Try to get file info first (to check if it's a video)
    const resourceUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(url)}`;

    console.log("[video/resolve] Fetching resource info:", url);

    const resourceResponse = await fetch(resourceUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!resourceResponse.ok) {
      const errorText = await resourceResponse.text().catch(() => "");
      console.error("[video/resolve] Resource info failed:", resourceResponse.status, errorText);

      if (resourceResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Видео не доступно для предпросмотра",
            details: "Ссылка не является публичной или файл не найден. Убедитесь, что ссылка создана через кнопку «Поделиться» на Яндекс Диске.",
            code: "NOT_PUBLIC_OR_NOT_FOUND"
          },
          { status: 404 }
        );
      }

      if (resourceResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Доступ к файлу запрещён",
            details: "Файл не является публично доступным. Создайте публичную ссылку через «Поделиться» на Яндекс Диске.",
            code: "ACCESS_DENIED"
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Yandex Disk API error", details: `HTTP ${resourceResponse.status}` },
        { status: 502 }
      );
    }

    const resourceData = await resourceResponse.json();

    // Check if it's a video file
    const mediaType = resourceData.media_type || resourceData.type;
    const mimeType = resourceData.mime_type || "";
    const isVideo = mediaType === "video" || mimeType.startsWith("video/");

    // Step 2: Get the download link
    const downloadUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;

    console.log("[video/resolve] Fetching download link...");

    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text().catch(() => "");
      console.error("[video/resolve] Download link failed:", downloadResponse.status, errorText);

      return NextResponse.json(
        {
          error: "Не удалось получить ссылку для скачивания",
          details: `Yandex Disk API вернул HTTP ${downloadResponse.status}. Возможно, файл слишком большой для предпросмотра.`,
          code: "DOWNLOAD_FAILED"
        },
        { status: 502 }
      );
    }

    const downloadData = await downloadResponse.json();

    if (!downloadData.href) {
      return NextResponse.json(
        {
          error: "Яндекс Диск не вернул ссылку для скачивания",
          details: "Возможно, файл защищён от скачивания или превышен лимит запросов",
          code: "NO_DOWNLOAD_LINK"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      directUrl: downloadData.href,
      method: downloadData.method || "GET",
      isVideo,
      fileName: resourceData.name || null,
      fileSize: resourceData.size || null,
      mimeType: mimeType || null,
      // Yandex Disk temporary links expire
      expiresIn: 3600,
    });
  } catch (err) {
    console.error("[video/resolve] Error:", err);

    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Таймаут при обращении к Яндекс Диску", code: "TIMEOUT" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Failed to resolve video URL" },
      { status: 500 }
    );
  }
}
