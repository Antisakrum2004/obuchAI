"use client";

import { useState, useEffect } from "react";
import {
  Play,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Trash2,
  Loader2,
  Music2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, getFileIcon } from "@/lib/media-service";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  createdAt: string;
}

interface MediaViewerProps {
  /** ID статьи/урока */
  articleId: string;
  /** Показывать ли кнопку удаления (только admin) */
  canDelete?: boolean;
  /** Callback после удаления */
  onDelete?: (mediaId: string) => void;
}

export function MediaViewer({
  articleId,
  canDelete = false,
  onDelete,
}: MediaViewerProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!articleId) return;

    fetch(`/api/knowledge/media?articleId=${encodeURIComponent(articleId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMediaList(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleId]);

  const handleDelete = async (mediaId: string) => {
    if (!confirm("Удалить этот файл?")) return;

    setDeleting(mediaId);
    try {
      const response = await fetch(`/api/knowledge/media/${mediaId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
        onDelete?.(mediaId);
      }
    } catch {
      // Ошибка молча игнорируется
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="glass rounded-lg p-3 border-white/5 animate-pulse h-16"
          />
        ))}
      </div>
    );
  }

  if (mediaList.length === 0) {
    return null;
  }

  // Разделяем на видео и остальные
  const videos = mediaList.filter((m) => m.fileType === "video");
  const documents = mediaList.filter((m) => m.fileType === "document");
  const images = mediaList.filter((m) => m.fileType === "image");

  return (
    <div className="space-y-4">
      {/* Видео */}
      {videos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Play className="h-3.5 w-3.5" />
            Видео ({videos.length})
          </h4>

          <div className="space-y-3">
            {videos.map((video) => (
              <div key={video.id} className="space-y-2">
                {/* Video Player */}
                {activeVideo === video.id ? (
                  <div className="rounded-xl overflow-hidden border border-white/5 bg-black">
                    <video
                      src={video.url}
                      controls
                      className="w-full max-h-[480px]"
                      autoPlay
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveVideo(video.id)}
                    className="w-full glass rounded-xl p-4 border-white/5 hover:border-emerald-500/20 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                        <Play className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                          {video.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(video.fileSize)}
                          </span>
                          {video.duration && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDuration(video.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Delete button */}
                {canDelete && activeVideo !== video.id && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(video.id)}
                      disabled={deleting === video.id}
                      className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      {deleting === video.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Удалить
                    </button>
                  </div>
                )}

                {activeVideo === video.id && (
                  <div className="flex items-center gap-2">
                    <a
                      href={video.url}
                      download={video.fileName}
                      className="text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Скачать
                    </a>
                    <button
                      onClick={() => setActiveVideo(null)}
                      className="text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors"
                    >
                      Свернуть
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(video.id)}
                        disabled={deleting === video.id}
                        className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        {deleting === video.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Документы */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Документы ({documents.length})
          </h4>

          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="glass rounded-lg p-3 border-white/5 flex items-center gap-3 group hover:border-emerald-500/20 transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/50 shrink-0">
                  <span className="text-sm">
                    {getFileIcon(doc.fileType, doc.mimeType)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 bg-secondary/50"
                    >
                      {doc.mimeType === "application/pdf"
                        ? "PDF"
                        : doc.mimeType.includes("presentation")
                        ? "PPTX"
                        : "DOCX"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    title="Открыть"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                  <a
                    href={doc.url}
                    download={doc.fileName}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    title="Скачать"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                      title="Удалить"
                    >
                      {deleting === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Изображения */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" />
            Изображения ({images.length})
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative group glass rounded-lg overflow-hidden border-white/5 hover:border-emerald-500/20 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.fileName}
                  className="w-full h-32 object-cover"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-white" />
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="p-2 rounded-full bg-white/10 hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  )}
                </div>

                <div className="p-2">
                  <p className="text-[10px] text-muted-foreground truncate">
                    {img.fileName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${String(remainMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
