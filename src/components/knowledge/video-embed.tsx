"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, AlertCircle, ShieldCheck, Cloud, RefreshCw } from "lucide-react";
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

// ─── YouTube Player with smart fallback ───
// Default: Invidious (open-source YouTube proxy — bypasses bot check & embed restrictions)
// Fallback: YouTube nocookie → YouTube direct → link
// Detects Error 153 (embed blocked) via YouTube postMessage API

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://vid.puffyan.us",
  "https://invidious.jing.rocks",
];

type YouTubeStrategy = "invidious" | "nocookie" | "direct" | "link";

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<YouTubeStrategy>("invidious");
  const [invidiousIdx, setInvidiousIdx] = useState(0);
  const [manualOverride, setManualOverride] = useState<YouTubeStrategy | null>(null);
  const [ytError, setYtError] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Current effective strategy (manual override takes precedence)
  const effectiveStrategy = manualOverride || strategy;

  const embedUrl = (() => {
    switch (effectiveStrategy) {
      case "invidious":
        return `${INVIDIOUS_INSTANCES[invidiousIdx % INVIDIOUS_INSTANCES.length]}/embed/${videoId}`;
      case "nocookie":
        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
      case "direct":
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      default:
        return null;
    }
  })();

  // Listen for YouTube iframe postMessage errors (Error 150, 153, etc.)
  useEffect(() => {
    if (effectiveStrategy !== "nocookie" && effectiveStrategy !== "direct") return;

    const handler = (event: MessageEvent) => {
      try {
        // YouTube posts JSON messages like {"event":"infoDelivery",...} or error info
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          // YouTube error events
          if (data.event === "onError" || data.event === "infoDelivery") {
            const code = data?.info?.code || data?.errorCode;
            if (code) {
              // Error 150 = embed not allowed, 153 = player config error
              setYtError(code);
              // Auto-switch to Invidious on YouTube errors
              if (code === 150 || code === 153 || code === 100 || code === 101 || code === 5) {
                setStrategy("invidious");
                setManualOverride("invidious");
              }
            }
          }
        }
      } catch {
        // Not JSON or not a YouTube message — ignore
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [effectiveStrategy]);

  // Auto-fallback for Invidious: try next instance after 10s if no load
  useEffect(() => {
    if (manualOverride) return;
    if (strategy === "invidious") {
      const timer = setTimeout(() => {
        if (invidiousIdx < INVIDIOUS_INSTANCES.length - 1) {
          setInvidiousIdx(prev => prev + 1);
        }
        // Don't give up entirely — just try next instance
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [strategy, invidiousIdx, manualOverride]);

  const handleIframeError = useCallback(() => {
    if (effectiveStrategy === "invidious") {
      if (invidiousIdx < INVIDIOUS_INSTANCES.length - 1) {
        setInvidiousIdx(prev => prev + 1);
      } else {
        setStrategy("nocookie");
      }
    } else if (effectiveStrategy === "nocookie") {
      setStrategy("direct");
    } else if (effectiveStrategy === "direct") {
      setStrategy("link");
    }
  }, [effectiveStrategy, invidiousIdx]);

  const switchTo = useCallback((s: YouTubeStrategy) => {
    setManualOverride(s);
    setStrategy(s);
    setYtError(null);
  }, []);

  const strategyLabel: Record<YouTubeStrategy, string> = {
    invidious: "Альт. плеер",
    nocookie: "YouTube (nocookie)",
    direct: "YouTube",
    link: "Ссылка",
  };

  const strategyBtnLabel: Record<YouTubeStrategy, string> = {
    invidious: "Alt",
    nocookie: "YT",
    direct: "YT2",
    link: "Link",
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className={cn(
          "text-[10px] px-1.5 py-0",
          effectiveStrategy === "invidious"
            ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
            : "border-red-500/30 text-red-400 bg-red-500/10"
        )}>
          {effectiveStrategy === "invidious" ? "Alt Player" : sourceTypeLabels.youtube}
        </Badge>
        {/* Manual strategy switcher */}
        <div className="ml-auto flex items-center gap-1">
          {(["invidious", "nocookie", "direct"] as YouTubeStrategy[]).map(s => (
            <button
              key={s}
              onClick={() => switchTo(s)}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded transition-colors",
                effectiveStrategy === s
                  ? "bg-white/15 text-white font-medium"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
              title={strategyLabel[s]}
            >
              {strategyBtnLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {/* YouTube error banner */}
      {ytError && (effectiveStrategy === "nocookie" || effectiveStrategy === "direct") && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>YouTube ошибка {ytError} — автор запретил встраивание или региональная блокировка</span>
          <button
            onClick={() => switchTo("invidious")}
            className="ml-auto shrink-0 underline hover:text-yellow-300"
          >
            Переключить на Alt
          </button>
        </div>
      )}

      {effectiveStrategy === "link" ? (
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить встроенный плеер. Нажмите кнопку ниже, чтобы посмотреть видео.
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
              onClick={() => switchTo("invidious")}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm font-medium"
            >
              <ShieldCheck className="h-4 w-4" />
              Попробовать Alt плеер
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl border border-white/5" style={{ paddingBottom: "56.25%" }}>
          <iframe
            key={`${effectiveStrategy}-${invidiousIdx}`}
            ref={effectiveStrategy === "nocookie" || effectiveStrategy === "direct" ? iframeRef : undefined}
            src={embedUrl!}
            title={title || "YouTube видео"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full"
            onError={handleIframeError}
          />
        </div>
      )}

      {/* Hints */}
      {effectiveStrategy !== "link" && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/60">
            {effectiveStrategy === "invidious"
              ? "Alt плеер (Invidious) — видео без ограничений YouTube"
              : "Если видео не играет — нажмите Alt"
            }
          </p>
          <div className="flex items-center gap-3">
            {effectiveStrategy === "invidious" && invidiousIdx > 0 && (
              <button
                onClick={() => setInvidiousIdx(prev => (prev + 1) % INVIDIOUS_INSTANCES.length)}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-purple-400 transition-colors"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Другой сервер
              </button>
            )}
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
