"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ───

interface VideoPlayerProps {
  url: string;
  sourceType?: string;
  title?: string;
  className?: string;
}

type SourceKind = "youtube" | "rutube" | "vk" | "local" | "direct" | "other";

// ─── URL Detection & Parsing ───

function detectSourceKind(url: string): SourceKind {
  if (!url) return "other";
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("rutube.ru")) return "rutube";
    if (hostname.includes("vk.com") || hostname.includes("vkvideo")) return "vk";
    // Direct video file extensions
    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) return "direct";
    return "other";
  } catch {
    // Not a valid URL — treat as local filename
    return "local";
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

const sourceLabels: Record<SourceKind, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  local: "Видео",
  direct: "Видео",
  other: "Ссылка",
};

// ─── Shared responsive iframe wrapper ───

function ResponsiveIframe({
  src,
  title,
  onError,
  allow = "autoplay; encrypted-media; fullscreen",
}: {
  src: string;
  title: string;
  onError?: () => void;
  allow?: string;
}) {
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-white/5">
      <iframe
        src={src}
        title={title}
        allow={allow}
        allowFullScreen
        className="absolute inset-0 h-full w-full"
        onError={onError}
      />
    </div>
  );
}

// ─── Cloud Link Button (universal fallback) ───

function CloudLinkButton({ url, label }: { url: string; label: string }) {
  return (
    <div className="glass rounded-xl p-5 border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
          Облачное
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Видеоматериал хранится в облаке. Нажмите кнопку ниже, чтобы перейти к просмотру.
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
  );
}

// ─── Header bar (play icon + label + source badge) ───

function PlayerHeader({ kind, extra }: { kind: SourceKind; extra?: React.ReactNode }) {
  const badgeColors: Record<SourceKind, string> = {
    youtube: "border-red-500/30 text-red-400 bg-red-500/10",
    rutube: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    vk: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    local: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    direct: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    other: "border-white/20 text-muted-foreground bg-white/5",
  };

  return (
    <div className="flex items-center gap-2 mb-2">
      <Play className="h-4 w-4 text-emerald-400" />
      <span className="text-sm font-medium">Видео</span>
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", badgeColors[kind])}>
        {sourceLabels[kind]}
      </Badge>
      {extra}
    </div>
  );
}

// ─── YouTube Player ───

type YTStrategy = "embed" | "link";

function YouTubePlayer({ videoId, title }: { videoId: string; title?: string }) {
  const [strategy, setStrategy] = useState<YTStrategy>("embed");
  const [iframeError, setIframeError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

  useEffect(() => {
    if (strategy === "link") return;
    const timer = setTimeout(() => setShowFallback(true), 6000);
    return () => clearTimeout(timer);
  }, [strategy]);

  useEffect(() => {
    if (strategy === "link") return;
    const handler = (event: MessageEvent) => {
      try {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          if (data.event === "onError" || (data.event === "infoDelivery" && data?.info?.errorCode)) {
            setIframeError(true);
          }
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [strategy]);

  if (strategy === "link") {
    return (
      <div className="space-y-2">
        <PlayerHeader kind="youtube" />
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить встроенный плеер. Откройте видео напрямую на YouTube.
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium"
          >
            <Play className="h-4 w-4" />
            Открыть на YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PlayerHeader kind="youtube" />
      <ResponsiveIframe
        src={embedUrl}
        title={title || "YouTube видео"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        onError={() => {
          setIframeError(true);
          setStrategy("link");
        }}
      />
      {showFallback && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground/60">
            {iframeError
              ? "Видео не загрузилось из-за ограничений встраивания."
              : "Если видео не загружается — откройте на YouTube."}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors font-medium shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            Открыть на YouTube
          </a>
        </div>
      )}
    </div>
  );
}

// ─── RuTube Player ───

function RutubePlayer({ videoId, title }: { videoId: string; title?: string }) {
  return (
    <div className="space-y-2">
      <PlayerHeader kind="rutube" />
      <ResponsiveIframe
        src={`https://rutube.ru/play/embed/${videoId}`}
        title={title || "Rutube видео"}
      />
    </div>
  );
}

// ─── VK Video Player ───

function VKPlayer({ url, title }: { url: string; title?: string }) {
  return (
    <div className="space-y-2">
      <PlayerHeader kind="vk" />
      <ResponsiveIframe src={url} title={title || "VK видео"} />
    </div>
  );
}

// ─── Local Video Player ───
// Streams video from local media server via /api/video/stream?file=...

function LocalVideoPlayer({ fileName, title }: { fileName: string; title?: string }) {
  const streamUrl = `/api/video/stream?file=${encodeURIComponent(fileName)}`;

  return (
    <div className="space-y-2">
      <PlayerHeader
        kind="local"
        extra={
          <span className="text-[10px] text-muted-foreground/50 ml-1">
            {fileName}
          </span>
        }
      />
      <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-white/5 bg-black">
        <video
          src={streamUrl}
          controls
          className="absolute inset-0 w-full h-full object-contain"
          preload="metadata"
        >
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      </div>
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[10px] text-muted-foreground">
          Локальное воспроизведение через медиа-сервер
        </span>
      </div>
    </div>
  );
}

// ─── Direct Video Player ───

function DirectVideoPlayer({ url, title }: { url: string; title?: string }) {
  return (
    <div className="space-y-2">
      <PlayerHeader kind="direct" />
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

// ─── Main VideoPlayer Component ───

/**
 * Универсальный видео-плеер.
 *
 * Автоматически определяет тип источника по URL:
 * - YouTube        → iframe embed
 * - RuTube         → iframe embed
 * - VK Видео       → iframe embed
 * - Локальный файл → <video> через /api/video/stream (прокси к MEDIA_SERVER_URL)
 * - Прямая ссылка  → <video> элемент (.mp4, .webm, .ogg)
 * - Другое         → кнопка «Открыть в облаке»
 *
 * ⛔ Яндекс.Диск убран (v0.37.2): 403 из-за IP-привязки подписей URL.
 */
export function VideoPlayer({ url, sourceType, title, className }: VideoPlayerProps) {
  if (!url) return null;

  const kind: SourceKind = (sourceType as SourceKind) || detectSourceKind(url);

  // YouTube
  if (kind === "youtube") {
    const videoId = extractYoutubeId(url);
    if (!videoId) return null;
    return (
      <div className={cn("space-y-2", className)}>
        <YouTubePlayer videoId={videoId} title={title} />
      </div>
    );
  }

  // RuTube
  if (kind === "rutube") {
    const videoId = extractRutubeId(url);
    if (!videoId) return null;
    return (
      <div className={cn("space-y-2", className)}>
        <RutubePlayer videoId={videoId} title={title} />
      </div>
    );
  }

  // VK Video
  if (kind === "vk") {
    return (
      <div className={cn("space-y-2", className)}>
        <VKPlayer url={url} title={title} />
      </div>
    );
  }

  // Local video file — stream via /api/video/stream?file=...
  if (kind === "local") {
    return (
      <div className={cn("space-y-2", className)}>
        <LocalVideoPlayer fileName={url} title={title} />
      </div>
    );
  }

  // Direct video URL
  if (kind === "direct") {
    return (
      <div className={cn("space-y-2", className)}>
        <DirectVideoPlayer url={url} title={title} />
      </div>
    );
  }

  // Unknown / other — cloud link button
  return (
    <div className={cn("space-y-2", className)}>
      <PlayerHeader kind="other" />
      <CloudLinkButton url={url} label={sourceLabels[kind] || sourceLabels.other} />
    </div>
  );
}
