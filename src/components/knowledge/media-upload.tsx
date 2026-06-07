"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  FileVideo,
  FileText,
  FileSpreadsheet,
  Image,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatFileSize, validateFile } from "@/lib/media-utils";

interface MediaUploadProps {
  /** Тип сущности, к которой крепится файл */
  entityType: "article" | "lesson" | "space";
  /** ID сущности */
  entityId: string;
  /** Callback после успешной загрузки */
  onUploadComplete?: (media: UploadedMedia) => void;
  /** Callback при ошибке */
  onUploadError?: (error: string) => void;
}

export interface UploadedMedia {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
  result?: UploadedMedia;
}

export function MediaUpload({
  entityType,
  entityId,
  onUploadComplete,
  onUploadError,
}: MediaUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      // Валидация
      const validation = validateFile(file);
      if (!validation.valid) {
        onUploadError?.(validation.error || "Файл не прошёл валидацию");
        return;
      }

      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

      setUploadingFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          progress: 0,
          status: "uploading",
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", entityType);
        formData.append("entityId", entityId);

        // Имитация прогресса (Vercel Blob не даёт реальный progress)
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === fileId && f.status === "uploading"
                ? { ...f, progress: Math.min(f.progress + Math.random() * 15, 90) }
                : f
            )
          );
        }, 500);

        const response = await fetch("/api/knowledge/media/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Ошибка загрузки");
        }

        const result: UploadedMedia = await response.json();

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: 100, status: "success", result }
              : f
          )
        );

        onUploadComplete?.(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Неизвестная ошибка";

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "error", error: message }
              : f
          )
        );

        onUploadError?.(message);
      }
    },
    [entityType, entityId, onUploadComplete, onUploadError]
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach(uploadFile);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeUploadingFile = useCallback((fileId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 mb-3">
            <Upload className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Перетащите файлы сюда
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            или нажмите для выбора
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
              Видео до 2 ГБ
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
              PDF до 100 МБ
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
              PPTX до 200 МБ
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
              DOCX до 100 МБ
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="video/mp4,video/webm,video/quicktime,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file) => (
            <div
              key={file.id}
              className="glass rounded-lg p-3 border-white/5 flex items-center gap-3"
            >
              {/* File Icon */}
              <div className="shrink-0">
                {file.file.type.startsWith("video/") ? (
                  <FileVideo className="h-5 w-5 text-blue-400" />
                ) : file.file.type === "application/pdf" ? (
                  <FileText className="h-5 w-5 text-red-400" />
                ) : file.file.type.includes("presentation") ? (
                  <FileSpreadsheet className="h-5 w-5 text-orange-400" />
                ) : file.file.type.startsWith("image/") ? (
                  <Image className="h-5 w-5 text-green-400" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* File Info + Progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">
                    {file.file.name}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatFileSize(file.file.size)}
                  </span>
                </div>

                {file.status === "uploading" && (
                  <Progress
                    value={file.progress}
                    className="h-1 mt-1.5"
                  />
                )}

                {file.status === "error" && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    <p className="text-[10px] text-red-400">{file.error}</p>
                  </div>
                )}

                {file.status === "success" && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <p className="text-[10px] text-emerald-400">Загружено</p>
                  </div>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeUploadingFile(file.id);
                }}
                className="shrink-0 p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
