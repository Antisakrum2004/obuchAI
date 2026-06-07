"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface BulkUploadProps {
  onUploadComplete?: () => void;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  spaceId: string;
}

interface Space {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
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
  const [categoryId, setCategoryId] = useState<string>("");
  const [autoProcess, setAutoProcess] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories and spaces
  useEffect(() => {
    const fetchData = async () => {
      try {
        const spacesRes = await fetch("/api/knowledge/spaces?all=true");
        if (spacesRes.ok) {
          const spacesData = await spacesRes.json();
          const spacesList = Array.isArray(spacesData) ? spacesData : [];
          setSpaces(spacesList);

          const allCats: Category[] = [];
          for (const space of spacesList) {
            const res = await fetch(
              `/api/knowledge/categories?spaceId=${space.id}&all=true`
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) allCats.push(...data);
            }
          }
          setCategories(allCats);
        }
      } catch {
        // silently fail
      }
    };
    fetchData();
  }, []);

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
    // Reset input so same files can be selected again
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
    if (files.length === 0 || !categoryId) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentFileIndex(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("categoryId", categoryId);
      formData.append("autoProcess", String(autoProcess));
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 85));
        setCurrentFileIndex((prev) => {
          const next = prev + 1;
          return next < files.length ? Math.floor(next * 0.3) : prev;
        });
      }, 500);

      const res = await fetch("/api/knowledge/bulk-upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (res.ok) {
        setUploadProgress(100);
        setCurrentFileIndex(files.length);
        const data = await res.json();
        setResult(data);
        onUploadComplete?.();
      } else {
        const errData = await res.json();
        setError(errData.error || "Ошибка загрузки");
      }
    } catch {
      setError("Ошибка сети при загрузке файлов");
    } finally {
      setUploading(false);
    }
  };

  const spaceName = (spaceId: string) =>
    spaces.find((s) => s.id === spaceId)?.name || "";

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="glass rounded-xl p-5 border-white/5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Files className="h-4 w-4 text-emerald-400" />
        Массовая загрузка файлов
      </h3>
      <p className="text-xs text-muted-foreground">
        Загрузите несколько файлов — каждый файл станет отдельной статьёй с прикреплённым документом.
        Поддерживаются: PDF, PPTX, DOCX, видео, изображения.
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
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5"
              >
                {getFileTypeIcon(file.name)}
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
            ))}
          </div>
        </div>
      )}

      {/* Category Selection + Auto Process */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs text-muted-foreground">Категория</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="Выберите категорию" />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-white/10">
              {spaces.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  disabled
                  className="font-semibold text-emerald-400"
                >
                  {s.icon || "📚"} {s.name}
                </SelectItem>
              ))}
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  ├ {c.icon || "📁"} {c.name} ({spaceName(c.spaceId)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={autoProcess}
              onCheckedChange={(v) => setAutoProcess(v === true)}
              className="border-white/20"
            />
            AI-обработка автоматически
          </label>
        </div>
      </div>

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

      {/* Upload Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || !categoryId || uploading}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {uploading
            ? "Загрузка..."
            : `Загрузить ${files.length > 0 ? `${files.length} файл(ов)` : ""}`}
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
