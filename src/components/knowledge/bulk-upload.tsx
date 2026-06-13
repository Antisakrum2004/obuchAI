"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  Files,
  Check,
  X,
  Loader2,
  FileText,
  Presentation,
  Video,
  Image,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { toast } from "sonner";

interface BulkUploadProps {
  onUploadComplete?: () => void;
}

interface UploadResult {
  message: string;
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    fileName: string;
    fileType: string;
    status: string;
  }>;
  errors?: Array<{ fileName: string; error: string }>;
}

/** Single-file upload result from the bulk-upload API */
interface SingleFileResult {
  message: string;
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    fileName: string;
    fileType: string;
    status: string;
    spaceId: string;
  }>;
  errors?: Array<{ fileName: string; error: string }>;
}

// File type icons
function getFileTypeIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-400" />;
  if (["pptx", "ppt"].includes(ext || "")) return <Presentation className="h-4 w-4 text-orange-400" />;
  if (["mp4", "webm", "mov", "avi"].includes(ext || "")) return <Video className="h-4 w-4 text-blue-400" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "")) return <Image className="h-4 w-4 text-green-400" />;
  if (["docx", "doc"].includes(ext || "")) return <FileText className="h-4 w-4 text-blue-300" />;
  return <Files className="h-4 w-4 text-muted-foreground" />;
}

const ACCEPTED_EXTENSIONS = ".pdf,.pptx,.ppt,.docx,.doc,.mp4,.webm,.mov,.png,.jpg,.jpeg,.gif,.webp,.svg";

export function BulkUpload({ onUploadComplete }: BulkUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [autoProcess, setAutoProcess] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track per-file upload status
  const [fileStatuses, setFileStatuses] = useState<Array<"pending" | "uploading" | "success" | "error">>([]);

  // No manual space selection — AI auto-determines

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length > 0) {
      setFiles((prev) => [...prev, ...selectedFiles]);
      setResult(null);
      setError(null);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    // AI auto-determines space — no manual selection needed

    setUploading(true);
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setError(null);
    setResult(null);
    setFileStatuses(files.map(() => "pending"));

    const allArticles: UploadResult["articles"] = [];
    const allErrors: Array<{ fileName: string; error: string }> = [];

    try {
      // Upload files ONE BY ONE to avoid 413 (Request Entity Too Large)
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        setFileStatuses((prev) => {
          const next = [...prev];
          next[i] = "uploading";
          return next;
        });

        const file = files[i];
        const formData = new FormData();
        formData.append("files", file);
        formData.append("spaceId", ""); // AI auto-assigns
        formData.append("autoProcess", String(autoProcess));
        formData.append("autoCategorize", "true");

        try {
          const res = await fetch("/api/knowledge/bulk-upload", {
            method: "POST",
            body: formData,
          });

          // Handle non-JSON responses (e.g. 413 from platform)
          let data: SingleFileResult;
          try {
            data = await res.json();
          } catch {
            if (res.status === 413) {
              throw new Error(
                `Файл слишком большой для загрузки (${formatBytes(file.size)}). ` +
                `Используйте внешнюю ссылку для больших файлов.`
              );
            }
            throw new Error(
              `Сервер вернул ошибку ${res.status}. Попробуйте файл меньшего размера.`
            );
          }

          if (res.ok || data.articles?.length > 0) {
            allArticles.push(...(data.articles || []));
            setFileStatuses((prev) => {
              const next = [...prev];
              next[i] = "success";
              return next;
            });
          } else {
            const errMsg = data.errors?.map((e) => e.error).join("; ") || "Ошибка загрузки";
            const fileErrors = errMsg;
            allErrors.push({ fileName: file.name, error: fileErrors });
            setFileStatuses((prev) => {
              const next = [...prev];
              next[i] = "error";
              return next;
            });
          }
        } catch (fileErr) {
          const msg = fileErr instanceof Error ? fileErr.message : "Ошибка сети";
          allErrors.push({ fileName: file.name, error: msg });
          setFileStatuses((prev) => {
            const next = [...prev];
            next[i] = "error";
            return next;
          });
        }

        // Update progress
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Compose final result
      const successCount = allArticles.length;
      const failCount = allErrors.length;

      if (successCount > 0) {
        setResult({
          message: `Загружено ${successCount} из ${files.length} файлов`,
          articles: allArticles,
          errors: failCount > 0 ? allErrors : undefined,
        });

        if (failCount === 0) {
          toast.success(
            `Загружено ${successCount} ${successCount === 1 ? "файл" : successCount < 5 ? "файла" : "файлов"}`,
            { description: "Файлы добавлены в очередь обработки", duration: 5000 }
          );
        } else {
          toast.warning(
            `Загружено ${successCount} из ${successCount + failCount} файлов`,
            {
              description: `${failCount} ${failCount === 1 ? "файл" : failCount < 5 ? "файла" : "файлов"} не удалось загрузить`,
              duration: 7000,
            }
          );
          setError(
            `${failCount} файл(ов) не загружено: ${allErrors
              .map((e) => `${e.fileName}: ${e.error}`)
              .join("; ")}`
          );
        }
        onUploadComplete?.();

        // ── Client-side AI processing trigger (backup for server-side waitUntil) ──
        // After upload completes, trigger AI processing for each article from the client.
        // This ensures processing runs even if the server-side fire-and-forget fails
        // (e.g. Vercel function terminates before waitUntil completes).
        if (autoProcess && allArticles.length > 0) {
          // Run in background — don't block the UI
          (async () => {
            for (const article of allArticles) {
              try {
                const aiTypes = ["content", "metadata", "glossary"];
                for (const type of aiTypes) {
                  try {
                    const res = await fetch("/api/knowledge/ai", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ articleId: article.id, type }),
                    });
                    // If already processed (409/conflict) or AI not configured (503), skip
                    if (res.status === 503) break; // AI not configured — stop
                    // Silently continue on errors — server may have already processed
                  } catch {
                    // Network error — skip silently
                  }
                }
              } catch {
                // Skip this article on error
              }
            }
          })();
        }
      } else {
        setError(
          allErrors.map((e) => `${e.fileName}: ${e.error}`).join("; ")
        );
      }
    } catch {
      setError("Ошибка сети при загрузке файлов");
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="glass rounded-xl p-5 border-white/5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Files className="h-4 w-4 text-emerald-400" />
        Массовая загрузка файлов
      </h3>
      <p className="text-xs text-muted-foreground">
        Загрузите файлы — каждый станет отдельной статьёй. AI автоматически определит категорию для каждого файла.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
          dragOver
            ? "border-emerald-500/50 bg-emerald-500/10"
            : "border-white/10 hover:border-white/20 hover:bg-white/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload
          className={cn(
            "h-8 w-8 mx-auto mb-3",
            dragOver ? "text-emerald-400" : "text-muted-foreground/40"
          )}
        />
        <p className="text-sm font-medium text-muted-foreground">
          Перетащите файлы сюда
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          или нажмите для выбора · PDF, PPTX, DOCX, видео, изображения
        </p>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Выбрано файлов: {files.length} · Общий размер: {formatBytes(totalSize)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              className="h-6 text-xs text-muted-foreground hover:text-red-400"
            >
              Убрать все
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {files.map((file, i) => {
              const status = fileStatuses[i];
              return (
                <div
                  key={`${file.name}-${i}`}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                    status === "uploading" ? "bg-blue-500/5 border-blue-500/20" :
                    status === "success" ? "bg-emerald-500/5 border-emerald-500/20" :
                    status === "error" ? "bg-red-500/5 border-red-500/20" :
                    "bg-white/[0.02] border-white/5"
                  )}
                >
                  {status === "uploading" ? (
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                  ) : status === "success" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    getFileTypeIcon(file.name)
                  )}
                  <span className="text-xs flex-1 truncate">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatBytes(file.size)}
                  </span>
                  {!uploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI auto-determines space & category */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        AI автоматически определит раздел, сложность и создаст категорию
      </div>

      {/* AI Processing toggle */}
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <Checkbox
          checked={autoProcess}
          onCheckedChange={(v) => setAutoProcess(v === true)}
          className="border-white/20"
        />
        <span className="text-muted-foreground">
          AI-обработка автоматически (метаданные, глоссарий)
        </span>
      </label>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Загрузка {currentFileIndex >= 0 ? `(${currentFileIndex + 1}/${files.length})` : ""}...
            </span>
            <span className="text-emerald-400">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/50 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-2">
          <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
            <Check className="h-4 w-4" />
            {result.message}
          </p>
          {result.articles && result.articles.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {result.articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>{article.fileType}</span>
                  <span className="truncate">{article.title}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shrink-0"
                  >
                    <Sparkles className="h-2 w-2 mr-0.5" />
                    AI
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0"
                  >
                    в очереди
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {result.errors && result.errors.length > 0 && (
            <div className="space-y-1 mt-2">
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-400/80">
                  {err.fileName}: {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Button — always enabled when files selected (category is optional) */}
      <div className="flex gap-2">
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {uploading
            ? "Загрузка..."
            : `Загрузить ${files.length > 0 ? `${files.length} файл(ов)` : "файлы"}`}
        </Button>
        {files.length > 0 && !uploading && (
          <Button
            variant="ghost"
            onClick={clearFiles}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}
