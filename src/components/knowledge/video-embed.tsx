"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Play, Loader2, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoEmbedProps {
  url: string;
  sourceType?: string;
  title?: string;
  className?: string;
}

function detectSourceType(url: string): string {
  // Handle s3:// URIs — private S3 storage
  if (url.startsWith("s3://")) return "direct";
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
 * YouTube player strategy:
 * 1. youtube-nocookie.com (privacy-enhanced, less tracking, less browser blocking)
 * 2. Direct youtube.com embed (fallback)
 * 3. Link to YouTube (if embeds completely fail)
 */

const sourceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  rutube: "Rutube",
  vk: "VK Видео",
  yandex_disk: "Яндекс Диск",
  s3: "S3 Хранилище",
  direct: "Видео",
  other: "Ссылка",
};

// ─── Protected Video Player (S3 direct download) ───

/**
 * Компонент для воспроизведения видео из приватного S3-хранилища.
 *
 * Схема работы (БЕЗ проксирования через Vercel):
 * 1. Запрашиваем signed URL через ?format=json (один короткий API-вызов)
 * 2. Устанавливаем signed URL как <video src>
 * 3. Браузер качает видео НАПРЯМУЮ из Selectel — без участия Vercel
 *
 * Это экономит трафик Selectel: видео не гоняется через сервера AWS в США.
 * Range-запросы (перемотка) тоже идут напрямую в Selectel.
 */
function ProtectedVideoPlayer({ apiPath, title, className }: { apiPath: string; title?: string; className?: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Запрос signed URL через JSON API.
   * Жёсткая обработка ошибок: отличаем HTTP-ошибку от невалидного JSON
   * от пустого ответа — и всё показываем в UI.
   */
  const fetchSignedUrl = useCallback((mediaId: string): Promise<string> => {
    return fetch(`/api/knowledge/video/${mediaId}?format=json`)
      .then(async (res) => {
        // Сначала пробуем распарсить JSON — даже при ошибке сервер может вернуть { error }
        let data: Record<string, unknown>;
        try {
          data = await res.json();
        } catch {
          // Сервер вернул не JSON (HTML-ошибка, 302-редирект на HTML и т.д.)
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Проверьте авторизацию и попробуйте обновить страницу.`);
        }

        if (!res.ok) {
          const msg = (data.error as string) || (data.details as string) || `Ошибка сервера (HTTP ${res.status})`;
          throw new Error(msg);
        }

        if (!data.url || typeof data.url !== "string") {
          throw new Error("Сервер не вернул ссылку на видео (пустой url в ответе)");
        }

        console.log("[ProtectedVideoPlayer] Signed URL obtained, first 100 chars:", (data.url as string).substring(0, 100));
        return data.url as string;
      });
  }, []);

  // Fetch signed URL on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSignedUrl(null);

    const mediaId = apiPath.split("/").pop();
    if (!mediaId) {
      setError("Некорректный путь к видео: не удалось извлечь ID из пути");
      setLoading(false);
      return;
    }

    fetchSignedUrl(mediaId)
      .then((url) => {
        if (!cancelled) {
          setSignedUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Не удалось загрузить видео";
          console.error("[ProtectedVideoPlayer] fetchSignedUrl error:", msg);
          setError(msg);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [apiPath, fetchSignedUrl]);

  const handleRetry = () => {
    setSignedUrl(null);
    setError(null);
    setLoading(true);

    const mediaId = apiPath.split("/").pop();
    if (!mediaId) return;

    fetchSignedUrl(mediaId)
      .then((url) => {
        setSignedUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Не удалось загрузить видео";
        setError(msg);
        setLoading(false);
      });
  };

  const handleVideoError = () => {
    // Диагностика: показываем первые символы URL, по которому не загрузилось видео
    const urlHint = signedUrl ? signedUrl.substring(0, 80) + "..." : "(нет URL)";
    const msg = `Не удалось воспроизвести видео. URL: ${urlHint}. Возможно, ссылка истекла или файл не найден в S3.`;
    console.error("[ProtectedVideoPlayer] <video> onError:", msg);
    setError(msg);
    setLoading(false);
  };

  const handleVideoWaiting = () => {
    setBuffering(true);
  };

  const handleVideoPlaying = () => {
    setBuffering(false);
    setLoading(false);
  };

  const handleVideoCanPlay = () => {
    setBuffering(false);
    setLoading(false);
  };

  const handleLoadStart = () => {
    setLoading(true);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium">Видео</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
          Защищённое
        </Badge>
        <span className="text-[10px] text-emerald-400/60 flex items-center gap-1 ml-auto">
          <ShieldCheck className="h-3 w-3" />
          Приватный доступ
        </span>
      </div>

      <div className="glass rounded-xl p-2 border-white/5 overflow-hidden relative">
        {loading && (
          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 gap-3">
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
              <span className="text-sm text-muted-foreground">Загрузка видео...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3">
                  {error}
                </p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors text-xs font-medium"
                >
                  <RefreshCw className="h-3 w-3" />
                  Повторить
                </button>
              </div>
            </div>
          </div>
        )}

        {signedUrl && (
          <video
            ref={videoRef}
            src={signedUrl}
            controls
            className={cn("w-full rounded-lg", loading && "sr-only")}
            preload="metadata"
            onLoadStart={handleLoadStart}
            onCanPlay={handleVideoCanPlay}
            onError={handleVideoError}
            onWaiting={handleVideoWaiting}
            onPlaying={handleVideoPlaying}
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        )}

        {/* Buffering indicator for large files */}
        {buffering && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none rounded-lg">
            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-lg">
              <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
              <span className="text-xs text-white">Буферизация...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── YouTube Player with nocookie + direct fallback ───

function YouTubePlayer({ videoId, title, className }: { videoId: string; title?: string; className?: string }) {
  const [strategy, setStrategy] = useState<"nocookie" | "direct" | "link">("nocookie");
  const [iframeError, setIframeError] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);

  const embedUrl =
    strategy === "nocookie"
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : strategy === "direct"
        ? `https://www.youtube.com/embed/${videoId}`
        : null;

  // Auto-fallback: if nocookie iframe doesn't signal load within 8s, try direct
  useEffect(() => {
    if (strategy === "nocookie" && !iframeError) {
      const timer = setTimeout(() => {
        console.log("[YouTubePlayer] nocookie timed out, trying direct embed");
        setLoadTimeout(true);
        setStrategy("direct");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [strategy, iframeError]);

  const handleIframeError = useCallback(() => {
    if (strategy === "nocookie") {
      setStrategy("direct");
    } else if (strategy === "direct") {
      setStrategy("link");
    }
  }, [strategy]);

  const handleIframeLoad = useCallback(() => {
    // iframe loaded successfully — stop timeout
    setLoadTimeout(false);
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
            Не удалось загрузить встроенный плеер. Возможно, браузер блокирует YouTube или требуются VPN для региональных ограничений.
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

type YandexStrategy = "api" | "iframe" | "link";

function YandexDiskPlayer({ url, title, className }: { url: string; title?: string; className?: string }) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<YandexStrategy>("api");

  const resolveUrl = useCallback(async () => {
    setLoading(true);
    setDirectUrl(null);
    try {
      const res = await fetch("/api/knowledge/video", {
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
      } else {
        const data = await res.json().catch(() => ({}));
        console.log("[YandexDiskPlayer] API error:", data.error || data.details || res.status);
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

      {!loading && strategy === "iframe" && !iframeFailed && (() => {
        let playerSrc = url;
        try {
          const parsed = new URL(url);
          if (parsed.hostname.includes("disk.yandex") && parsed.pathname) {
            playerSrc = `https://disk.yandex.ru/player${parsed.pathname}`;
          }
        } catch {}
        return (
          <div className="glass rounded-xl p-2 border-white/5 overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
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
      })()}

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

  // ── Protected S3 video (our API route) → fetch signed URL via JS ──
  // If URL starts with /api/knowledge/video — it's a protected S3 video
  if (url.startsWith("/api/knowledge/video/")) {
    return <ProtectedVideoPlayer apiPath={url} title={title} className={className} />;
  }

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

  // Yandex Disk — API → iframe → link button
  if (type === "yandex_disk") {
    return <YandexDiskPlayer url={url} title={title} className={className} />;
  }

  // direct / other — show video player
  // If URL is a direct S3 URL (not through our API), route through protected player
  if (url.includes("storage.selcloud.ru") || (url.includes("s3.") && url.includes(".storage."))) {
    // This shouldn't happen anymore (article page should route through /api/knowledge/video/by-article/),
    // but handle it as a fallback — redirect through our API
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">Видео</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground">
            {sourceTypeLabels[type] || sourceTypeLabels.other}
          </Badge>
        </div>
        <div className="glass rounded-xl p-5 border-white/5">
          <p className="text-sm text-muted-foreground mb-3">
            Видео хранится в защищённом хранилище. Для воспроизведения обновите страницу.
          </p>
        </div>
      </div>
    );
  }

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
