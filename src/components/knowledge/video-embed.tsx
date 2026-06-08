"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Loader2, RefreshCw } from "lucide-react";
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
    if (hostname.includes("disk.yandex") || hostname.includes("yandex") || hostname.includes("yadi.sk")) return "yandex_disk";
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
 * Invidious instances that proxy YouTube content — work without VPN in Russia.
 * We try them in order; if the first fails, fallback to the next.
 */
const INVIDIOUS_INSTANCES = [
  "inv.nadeko.net",
  "invidious.fdn.fr",
  "vid.puffyan.us",
  "invidious.nerdvpn.de",
  "yewtu.be",
];

const sourceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  yandex_disk: "Яндекс Диск",
  direct: "Видео",
  other: "Ссылка",
};

// ─── YouTube Player with Invidious proxy (works in Russia without VPN) ───

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [useInvidious, setUseInvidious] = useState(true);
  const [invidiousInstance, setInvidiousInstance] = useState(INVIDIOUS_INSTANCES[0]);
  const [iframeError, setIframeError] = useState(false);

  const embedUrl = useInvidious
    ? `https://${invidiousInstance}/embed/${videoId}`
    : `https://www.youtube.com/embed/${videoId}`;

  const handleIframeError = useCallback(() => {
    if (useInvidious) {
      // Try next Invidious instance
      const currentIdx = INVIDIOUS_INSTANCES.indexOf(invidiousInstance);
      if (currentIdx < INVIDIOUS_INSTANCES.length - 1) {
        setInvidiousInstance(INVIDIOUS_INSTANCES[currentIdx + 1]);
      } else {
        // All Invidious instances failed, fallback to YouTube directly
        setUseInvidious(false);
      }
    } else {
      setIframeError(true);
    }
  }, [useInvidious, invidiousInstance]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        {useInvidious ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Invidious
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
            {sourceTypeLabels.youtube}
          </Badge>
        )}
      </div>
      {iframeError ? (
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить видео. Возможно, требуется VPN для YouTube.
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
          >
            <Play className="h-4 w-4" />
            Открыть на YouTube
          </a>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            title={title || "YouTube видео"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            onError={handleIframeError}
            // If iframe doesn't load after 8s, try next instance
            onLoad={() => {}}
          />
        </div>
      )}
      {!useInvidious && !iframeError && (
        <p className="text-[10px] text-muted-foreground/60">
          Если видео не загружается — возможны региональные ограничения. Включите VPN или попробуйте позже.
        </p>
      )}
    </div>
  );
}

// ─── Yandex Disk Video Player with fallback strategies ───

type YandexStrategy = "api" | "iframe" | "link";

function YandexDiskPlayer({ url, title, className }: { url: string; title?: string; className?: string }) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<YandexStrategy>("api");

  const resolveUrl = useCallback(async () => {
    setLoading(true);
    setDirectUrl(null);
    try {
      const res = await fetch("/api/knowledge/video/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.directUrl) {
          setDirectUrl(data.directUrl);
          setStrategy("api");
          setLoading(false);
          return;
        }
      }

      // API failed — fallback to iframe embed of the Yandex Disk share page
      console.log("[YandexDiskPlayer] API failed, trying iframe fallback");
      setStrategy("iframe");
    } catch (err) {
      console.error("[YandexDiskPlayer] Error:", err);
      setStrategy("iframe");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    resolveUrl();
  }, [resolveUrl]);

  // If iframe also fails, show link
  const [iframeFailed, setIframeFailed] = useState(false);

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
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10px] text-muted-foreground">Видео с Яндекс Диска</span>
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

      {!loading && strategy === "iframe" && !iframeFailed && (
        <div className="glass rounded-xl p-2 border-white/5 overflow-hidden">
          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={url}
              title={title || "Яндекс Диск видео"}
              allowFullScreen
              allow="autoplay; encrypted-media"
              className="absolute inset-0 h-full w-full"
              onError={() => setIframeFailed(true)}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10px] text-muted-foreground">Плеер Яндекс Диска</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Открыть на Яндекс Диске
            </a>
          </div>
        </div>
      )}

      {!loading && (strategy === "link" || iframeFailed) && (
        <div className="glass rounded-xl p-5 border-white/5">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-3">
                Встроенный просмотр недоступен. Откройте видео на Яндекс Диске:
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

  // YouTube → Invidious proxy (works without VPN in Russia)
  if (type === "youtube") {
    const videoId = extractYoutubeId(url);
    if (!videoId) return null;
    return <YouTubePlayer videoId={videoId} title={title} className={className} />;
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

  // Yandex Disk — API → iframe → link button
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
