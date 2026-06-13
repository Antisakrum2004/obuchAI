"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, AlertCircle, ShieldCheck, Cloud, RefreshCw, Loader2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoEmbedProps {
  url: string;
  sourceType?: string;
  title?: string;
  className?: string;
}

function detectSourceType(url: string): string {
  if (!url) return "other";
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

const sourceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  yandex_disk: "Яндекс Диск",
  direct: "Видео",
  other: "Ссылка",
};

// ─── Cloud Link Button (fallback для облаков без iframe) ───

function CloudLinkButton({ url, label, className }: { url: string; label: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
          Облачное
        </Badge>
      </div>
      <div className="glass rounded-xl p-5 border-white/5">
        <p className="text-sm text-muted-foreground mb-4">
          Видеоматериал урока хранится в облаке. Нажмите кнопку ниже, чтобы перейти к просмотру.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
        >
          <Cloud className="h-4 w-4" />
          Смотреть видеоурок в облаке
        </a>
        <span className="text-[10px] text-muted-foreground ml-3">{label}</span>
      </div>
    </div>
  );
}

// ─── YouTube Player — native <video> via Piped API + fallbacks ───
// Strategy: proxy (native <video>) → piped embed → youtube iframe → link

type YouTubeStrategy = "proxy" | "piped" | "nocookie" | "direct" | "link";

interface VideoInfo {
  streamUrl: string | null;
  audioUrl: string | null;
  title: string;
  quality: string;
  isVideoOnly: boolean;
  pipedEmbedUrl: string;
}

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<YouTubeStrategy>("proxy");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch video stream info from our server-side API
  useEffect(() => {
    if (strategy !== "proxy") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/video/youtube-info?videoId=${videoId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: VideoInfo & { error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setStrategy("piped");
          return;
        }
        if (!data.streamUrl) {
          setError("Не удалось получить ссылку на видео");
          setStrategy("piped");
          return;
        }
        setVideoInfo(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error("[YouTubePlayer] fetch error:", err);
        setError("Ошибка загрузки видео");
        setStrategy("piped");
      });

    return () => { cancelled = true; };
  }, [videoId, strategy]);

  const switchTo = useCallback((s: YouTubeStrategy) => {
    setStrategy(s);
    setError(null);
  }, []);

  const embedUrl = (() => {
    switch (strategy) {
      case "piped":
        return `https://piped.video/embed/${videoId}`;
      case "nocookie":
        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
      case "direct":
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      default:
        return null;
    }
  })();

  const strategyBtnLabel: Record<YouTubeStrategy, string> = {
    proxy: "Плеер",
    piped: "Piped",
    nocookie: "YT",
    direct: "YT2",
    link: "Link",
  };

  const strategyBtnTooltip: Record<YouTubeStrategy, string> = {
    proxy: "Встроенный плеер (без блокировок)",
    piped: "Piped — альт. YouTube плеер",
    nocookie: "YouTube nocookie",
    direct: "YouTube прямой",
    link: "Открыть на YouTube",
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className={cn(
          "text-[10px] px-1.5 py-0",
          strategy === "proxy"
            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            : strategy === "piped"
              ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
              : "border-red-500/30 text-red-400 bg-red-500/10"
        )}>
          {strategy === "proxy" ? "Плеер" : strategy === "piped" ? "Piped" : sourceTypeLabels.youtube}
        </Badge>
        {/* Manual strategy switcher */}
        <div className="ml-auto flex items-center gap-1">
          {(["proxy", "piped", "nocookie", "direct"] as YouTubeStrategy[]).map(s => (
            <button
              key={s}
              onClick={() => switchTo(s)}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded transition-colors",
                strategy === s
                  ? "bg-white/15 text-white font-medium"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
              title={strategyBtnTooltip[s]}
            >
              {strategyBtnLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && strategy !== "link" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => switchTo("piped")}
            className="ml-auto shrink-0 underline hover:text-yellow-300"
          >
            Piped
          </button>
        </div>
      )}

      {/* Strategy: Proxy — native <video> with stream from Piped API */}
      {strategy === "proxy" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-white/5 bg-black/20" style={{ paddingBottom: "56.25%", position: "relative" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                <span className="text-xs text-muted-foreground">Загрузка видео...</span>
              </div>
            </div>
          ) : videoInfo?.streamUrl ? (
            <div className="glass rounded-xl p-1 border-white/5 overflow-hidden">
              <video
                ref={videoRef}
                src={videoInfo.streamUrl}
                controls
                className="w-full rounded-lg"
                preload="metadata"
                autoPlay
              >
                Ваш браузер не поддерживает воспроизведение видео.
              </video>
              {videoInfo.isVideoOnly && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-yellow-400">
                  <VolumeX className="h-3 w-3" />
                  Видеоряд без звука (нет прогрессивного потока). Попробуйте Piped или YT.
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Strategy: iframe (piped / nocookie / direct) */}
      {(strategy === "piped" || strategy === "nocookie" || strategy === "direct") && embedUrl && (
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            key={strategy}
            src={embedUrl}
            title={title || "YouTube видео"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full"
            onError={() => {
              // Auto-fallback chain
              if (strategy === "piped") switchTo("nocookie");
              else if (strategy === "nocookie") switchTo("direct");
              else switchTo("link");
            }}
          />
        </div>
      )}

      {/* Strategy: link — just show buttons */}
      {strategy === "link" && (
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить плеер. Нажмите кнопку ниже, чтобы посмотреть видео.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium"
            >
              <Play className="h-4 w-4" />
              Открыть на YouTube
            </a>
            <button
              onClick={() => switchTo("proxy")}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Попробовать плеер
            </button>
            <button
              onClick={() => switchTo("piped")}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm font-medium"
            >
              <ShieldCheck className="h-4 w-4" />
              Piped
            </button>
          </div>
        </div>
      )}

      {/* Hints */}
      {strategy !== "link" && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/60">
            {strategy === "proxy"
              ? "Встроенный плеер — видео без ограничений YouTube"
              : strategy === "piped"
                ? "Piped — альтернативный YouTube без блокировок"
                : "Если видео не играет — нажмите Плеер или Piped"
            }
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            YouTube
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Yandex Disk Video Player with fallback strategies ───

type YandexStrategy = "iframe" | "link";

function YandexDiskPlayer({ url, title, className }: { url: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<YandexStrategy>("iframe");
  const [iframeFailed, setIframeFailed] = useState(false);

  // If iframe also fails, show link
  if (iframeFailed || strategy === "link") {
    return (
      <CloudLinkButton url={url} label={sourceTypeLabels.yandex_disk} className={className} />
    );
  }

  let playerSrc = url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("disk.yandex") && parsed.pathname) {
      playerSrc = `https://disk.yandex.ru/player${parsed.pathname}`;
    }
  } catch {}

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
          {sourceTypeLabels.yandex_disk}
        </Badge>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={playerSrc}
          title={title || "Яндекс Диск видео"}
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen"
          className="absolute inset-0 h-full w-full"
          onError={() => {
            setIframeFailed(true);
            setStrategy("link");
          }}
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
  );
}

// ─── Main VideoEmbed Component ───

export function VideoEmbed({ url, sourceType, title, className }: VideoEmbedProps) {
  if (!url) return null;

  const type = sourceType || detectSourceType(url);

  // YouTube → native <video> via Piped API + fallbacks
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

  // Yandex Disk — iframe → fallback to cloud link button
  if (type === "yandex_disk") {
    return <YandexDiskPlayer url={url} title={title} className={className} />;
  }

  // Direct video URL — native <video> element
  if (type === "direct") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Прямая ссылка
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

  // Other / unknown — show cloud link button
  return <CloudLinkButton url={url} label={sourceTypeLabels[type] || sourceTypeLabels.other} className={className} />;
}
