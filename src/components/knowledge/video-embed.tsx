"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Cloud, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Detect browsers with strict tracking prevention that blocks 3rd-party cookies
function hasStrictTrackingPrevention(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Edge has tracking prevention on by default
  if (ua.includes("Edg/")) return true;
  // Firefox with strict content blocking
  // Safari with ITP
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return true;
  return false;
}

function getBrowserHint(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge: Настройки → Конфиденциальность → Предотвращение отслеживания → Основной";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari: Настройки → Конфиденциальность → Отключить «Предотвращать кросс-сайтовое отслеживание»";
  return "Отключите блокировку сторонних cookie для этого сайта";
}

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

// ─── YouTube Player — standard embed + browser hint for Edge/Safari ───

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  // Use youtube.com/embed/ directly — same domain as YouTube, so if user
  // is logged into YouTube in their browser, their cookies/session apply
  // and no "sign in to prove you're not a bot" check appears.
  // youtube-nocookie.com is a SEPARATE domain and may trigger anti-bot.
  const needsHint = hasStrictTrackingPrevention();
  const browserHint = getBrowserHint();

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
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || "YouTube видео"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {/* Hint for Edge/Safari users whose browsers block 3rd-party cookies */}
      {needsHint && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>Если YouTube просит войти в аккаунт — ваш браузер блокирует cookies.</p>
            <p className="text-blue-400/80">{browserHint}</p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Открыть на YouTube (без проблем)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Yandex Disk Video Player with fallback ───

function YandexDiskPlayer({ url, title, className }: { url: string; title?: string; className?: string }) {
  const [iframeFailed, setIframeFailed] = useState(false);

  if (iframeFailed) {
    return <CloudLinkButton url={url} label={sourceTypeLabels.yandex_disk} className={className} />;
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
          onError={() => setIframeFailed(true)}
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

  // YouTube → youtube.com/embed/ + browser hint for Edge/Safari
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
