"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoEmbedProps {
  url: string;
  sourceType?: string;
  title?: string;
  className?: string;
}

function detectSourceType(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("rutube.ru")) return "rutube";
    if (hostname.includes("vk.com") || hostname.includes("vkvideo")) return "vk";
    if (hostname.includes("disk.yandex") || hostname.includes("yandex")) return "yandex_disk";
    return "direct";
  } catch {
    return "other";
  }
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
    if (u.pathname.startsWith("/embed/")) {
      return u.pathname.split("/embed/")[1]?.split("/")[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractRutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/video/")) {
      return u.pathname.split("/video/")[1]?.split("/")[0] || null;
    }
    if (u.pathname.startsWith("/play/embed/")) {
      return u.pathname.split("/play/embed/")[1]?.split("/")[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert a Yandex Disk public link to an embeddable player URL.
 * Supports formats:
 * - https://disk.yandex.ru/d/XXXX  (file share)
 * - https://disk.yandex.ru/i/XXXX  (file share, new format)
 * - https://yadi.sk/d/XXXX         (short link)
 *
 * Yandex Disk has an undocumented embed player at:
 *   https://disk.yandex.ru/client/embed?...  (iframe-based)
 *
 * However, the most reliable approach is:
 * 1. Try the Public API to get a direct download link → HTML5 <video>
 * 2. If that fails, try iframe embed via the share URL
 * 3. If that also fails, show a nice link button
 */
function getYandexEmbedUrl(shareUrl: string): string | null {
  try {
    const u = new URL(shareUrl);
    // The Yandex Disk iframe player can be constructed from the share URL
    // Format: https://disk.yandex.ru/client/embed?hash=XXX
    // But the hash isn't directly in the URL. Alternative: just use the URL in an iframe
    // Yandex does NOT officially support iframe embedding of videos from Disk
    // So we cannot reliably construct an embed URL
    return null;
  } catch {
    return null;
  }
}

const sourceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  yandex_disk: "Яндекс Диск",
  direct: "Видео",
  other: "Ссылка",
};

// ─── Yandex Disk Video Player with multiple fallback strategies ───

type YandexStrategy = "api" | "iframe" | "link";

function YandexDiskPlayer({ url, title, className }: { url: string; title?: string; className?: string }) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<YandexStrategy>("api");

  const resolveUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/video/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Handle specific error codes from our resolve API
        const errorCode = data.code || "";
        if (errorCode === "NOT_PUBLIC_OR_NOT_FOUND" || res.status === 404) {
          setStrategy("link");
          setError("Видео не доступно для предпросмотра. Убедитесь, что ссылка создана через «Поделиться» на Яндекс Диске.");
        } else if (errorCode === "ACCESS_DENIED" || res.status === 403) {
          setStrategy("link");
          setError("Доступ к видео запрещён. Файл не является публичным.");
        } else if (errorCode === "TIMEOUT" || res.status === 504) {
          setStrategy("link");
          setError("Яндекс Диск не отвечает. Попробуйте позже или откройте видео напрямую.");
        } else {
          setStrategy("link");
          setError(data.error || data.details || `Ошибка сервера (HTTP ${res.status})`);
        }
        return;
      }

      const data = await res.json();
      if (data.directUrl) {
        setDirectUrl(data.directUrl);
        setStrategy("api");
      } else {
        setStrategy("link");
        setError("Не удалось получить ссылку для воспроизведения");
      }
    } catch (err) {
      console.error("[YandexDiskPlayer] Failed to resolve URL:", err);
      setStrategy("link");
      setError(err instanceof Error ? err.message : "Не удалось загрузить видео");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    resolveUrl();
  }, [resolveUrl]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
          {sourceTypeLabels.yandex_disk}
        </Badge>
      </div>

      {loading && (
        <div className="glass rounded-xl p-2 border-white/5">
          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 gap-3">
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
              <span className="text-sm text-muted-foreground">Загрузка видео...</span>
            </div>
          </div>
        </div>
      )}

      {!loading && strategy === "api" && directUrl && (
        <div className="glass rounded-xl p-2 border-white/5 overflow-hidden">
          <video
            src={directUrl}
            controls
            className="w-full rounded-lg"
            preload="metadata"
            crossOrigin="anonymous"
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10px] text-muted-foreground">
              Видео с Яндекс Диска
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Открыть оригинал
            </a>
          </div>
        </div>
      )}

      {!loading && (strategy === "link" || error) && (
        <div className="glass rounded-xl p-5 border-white/5">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-3">
                {error || "Видео не доступно для предпросмотра"}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
                >
                  <Play className="h-4 w-4" />
                  Смотреть видео на Яндекс Диске
                </a>
                <button
                  onClick={resolveUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 transition-colors text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  Повторить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main VideoEmbed Component ───

export function VideoEmbed({ url, sourceType, title, className }: VideoEmbedProps) {
  if (!url) return null;

  const type = sourceType || detectSourceType(url);

  if (type === "youtube") {
    const videoId = extractYoutubeId(url);
    if (!videoId) return null;

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
            {sourceTypeLabels[type]}
          </Badge>
        </div>
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || "YouTube видео"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (type === "rutube") {
    const videoId = extractRutubeId(url);
    if (!videoId) return null;

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
            {sourceTypeLabels[type]}
          </Badge>
        </div>
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://rutube.ru/play/embed/${videoId}`}
            title={title || "Rutube видео"}
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (type === "vk") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
            {sourceTypeLabels[type]}
          </Badge>
        </div>
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={url}
            title={title || "VK видео"}
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  // Yandex Disk — use server-side URL resolution + HTML5 <video> player with fallback
  if (type === "yandex_disk") {
    return <YandexDiskPlayer url={url} title={title} className={className} />;
  }

  // direct / other — show video player
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground">
          {sourceTypeLabels[type] || sourceTypeLabels.other}
        </Badge>
      </div>
      <div className="glass rounded-xl p-2 border-white/5 overflow-hidden">
        <video
          src={url}
          controls
          className="w-full rounded-lg"
          preload="metadata"
        >
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      </div>
    </div>
  );
}
