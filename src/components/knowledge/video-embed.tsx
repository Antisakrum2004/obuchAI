"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Cloud } from "lucide-react";
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
    return "direct";
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

const sourceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  local: "Видео",
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

// ─── YouTube Player — simplified, no IFrame API ───

type YTStrategy = "embed" | "link";

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<YTStrategy>("embed");
  const [iframeError, setIframeError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
            {sourceTypeLabels.youtube}
          </Badge>
        </div>
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
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
          {sourceTypeLabels.youtube}
        </Badge>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title || "YouTube видео"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          onError={() => {
            setIframeError(true);
            setStrategy("link");
          }}
        />
      </div>
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

// ─── Local Video Player — streams via /api/video/stream?file=... ───

function LocalVideoPlayer({ fileName, title, className }: { fileName: string; title?: string; className?: string }) {
  const streamUrl = `/api/video/stream?file=${encodeURIComponent(fileName)}`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
          {sourceTypeLabels.local}
        </Badge>
        <span className="text-[10px] text-muted-foreground/50 ml-1">{fileName}</span>
      </div>
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

// ─── Main VideoEmbed Component ───

export function VideoEmbed({ url, sourceType, title, className }: VideoEmbedProps) {
  if (!url) return null;

  const type = sourceType || detectSourceType(url);

  // YouTube → simple embed
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
            {sourceTypeLabels.rutube}
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
            {sourceTypeLabels.vk}
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

  // Local video file — stream via /api/video/stream?file=...
  if (type === "local") {
    return <LocalVideoPlayer fileName={url} title={title} className={className} />;
  }

  // Direct video URL — native <video> element
  if (type === "direct") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            {sourceTypeLabels.direct}
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
