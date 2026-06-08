"use client";

import { useEffect, useCallback } from "react";
import { X, Download, ZoomIn } from "lucide-react";

interface LightboxProps {
  /** Image URL to display */
  src: string;
  /** Alt text / filename */
  alt: string;
  /** Close handler */
  onClose: () => void;
  /** Optional download URL (if different from src) */
  downloadUrl?: string;
  /** Optional download filename */
  downloadName?: string;
}

/**
 * Full-screen image lightbox overlay.
 * Closes on Escape, X button, or clicking the backdrop.
 */
export function Lightbox({ src, alt, onClose, downloadUrl, downloadName }: LightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        title="Закрыть (Esc)"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg flex items-center justify-between">
          <p className="text-xs text-white/80 truncate flex-1">{alt}</p>
          <a
            href={downloadUrl || src}
            download={downloadName || alt}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors ml-2"
            title="Скачать"
          >
            <Download className="h-3.5 w-3.5 text-white/70" />
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Video modal overlay.
 * Closes on Escape, X button, or clicking the backdrop.
 * Remembers playback position while page is alive.
 */
interface VideoModalProps {
  /** Video URL */
  src: string;
  /** Video title / filename */
  title: string;
  /** Video element ID for position memory */
  videoId: string;
  /** Close handler */
  onClose: () => void;
  /** Optional: show download link */
  downloadUrl?: string;
  downloadName?: string;
}

const videoPositions = new Map<string, number>();

export function VideoModal({
  src,
  title,
  videoId,
  onClose,
  downloadUrl,
  downloadName,
}: VideoModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleVideoRef = (el: HTMLVideoElement | null) => {
    if (el) {
      const saved = videoPositions.get(videoId);
      if (saved && saved > 0) {
        el.currentTime = saved;
      }
      el.play().catch(() => {});
    }
  };

  const handleClose = () => {
    // Save current position
    const video = document.querySelector(
      `video[data-video-id="${videoId}"]`
    ) as HTMLVideoElement | null;
    if (video) {
      videoPositions.set(videoId, video.currentTime);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        title="Закрыть (Esc)"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Video container */}
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
          <video
            ref={handleVideoRef}
            src={src}
            controls
            data-video-id={videoId}
            className="w-full max-h-[80vh]"
          />
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-sm text-white/80 truncate flex-1">{title}</p>
          <div className="flex items-center gap-3 ml-3">
            {videoPositions.has(videoId) && (
              <span className="text-[10px] text-blue-400/60">
                Продолжить с {Math.floor(videoPositions.get(videoId) || 0)}с
              </span>
            )}
            <a
              href={downloadUrl || src}
              download={downloadName || title}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Скачать
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Check if a video has a saved position */
export function hasVideoPosition(videoId: string): boolean {
  return videoPositions.has(videoId) && (videoPositions.get(videoId) || 0) > 1;
}
