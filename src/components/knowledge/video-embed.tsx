"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, AlertCircle, ShieldCheck, Cloud } from "lucide-react";
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

// ─── YouTube Player with nocookie + direct fallback ───

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<"direct" | "nocookie" | "link">("direct");
  const [iframeError, setIframeError] = useState(false);

  const embedUrl =
    strategy === "direct"
      ? `https://www.youtube.com/embed/${videoId}`
      : strategy === "nocookie"
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;

  // Auto-fallback: if direct iframe doesn't signal load within 8s, try nocookie
  useEffect(() => {
    if (strategy === "direct" && !iframeError) {
      const timer = setTimeout(() => {
        setStrategy("nocookie");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [strategy, iframeError]);

  const handleIframeError = useCallback(() => {
    if (strategy === "direct") {
      setStrategy("nocookie");
    } else if (strategy === "nocookie") {
      setStrategy("link");
    }
  }, [strategy]);

  const handleIframeLoad = useCallback(() => {
    // iframe loaded successfully — stop timeout
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
          {sourceTypeLabels.youtube}
        </Badge>
      </div>
      {strategy === "link" || iframeError ? (
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить встроенный плеер. Некоторые браузеры (Edge, Safari) блокируют YouTube-iframe. Попробуйте VPN или откройте видео напрямую.
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
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl!}
            title={title || "YouTube видео"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full"
            onError={handleIframeError}
            onLoad={handleIframeLoad}
          />
        </div>
      )}
      {strategy !== "link" && !iframeError && (
        <p className="text-[10px] text-muted-foreground/60">
          Если видео не загружается — возможны региональные ограничения. Попробуйте VPN или{" "}
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground"
          >
            откройте на YouTube
          </a>.
        </p>
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

  // YouTube → nocookie + direct fallback
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
