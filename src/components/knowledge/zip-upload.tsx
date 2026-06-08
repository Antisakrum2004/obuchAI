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
import { Upload, FileArchive, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZipUploadProps {
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
  articles: Array<{ id: string; title: string; slug: string }>;
  queue: Array<{ id: string; type: string; status: string }>;
}

export function ZipUpload({ onUploadComplete }: ZipUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories and spaces
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spacesRes, ...catRes] = await Promise.all([
          fetch("/api/knowledge/spaces?all=true"),
          // We'll fetch categories after spaces
        ]);

        if (spacesRes.ok) {
          const spacesData = await spacesRes.json();
          const spacesList = Array.isArray(spacesData) ? spacesData : [];
          setSpaces(spacesList);

          // Fetch categories for each space
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".zip")) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !categoryId) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("categoryId", categoryId);

      // Simulate progress since fetch doesn't support upload progress natively
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const res = await fetch("/api/knowledge/import", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (res.ok) {
        setUploadProgress(100);
        const data = await res.json();
        setResult(data);
        onUploadComplete?.();
      } else {
        const errData = await res.json();
        setError(errData.error || "Ошибка импорта");
      }
    } catch {
      setError("Ошибка сети при загрузке файла");
    } finally {
      setUploading(false);
    }
  };

  const spaceName = (spaceId: string) =>
    spaces.find((s) => s.id === spaceId)?.name || "";

  return (
    <div className="glass rounded-xl p-5 border-white/5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileArchive className="h-4 w-4 text-emerald-400" />
        Импорт из ZIP-архива
      </h3>
      <p className="text-xs text-muted-foreground">
        Загрузите ZIP-файл, содержащий папки с материалами. Каждая папка станет
        отдельной статьёй.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
          dragOver
            ? "border-emerald-500/50 bg-emerald-500/10"
            : "border-white/10 hover:border-white/20 hover:bg-white/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload
          className={cn(
            "h-8 w-8 mx-auto mb-3",
            dragOver ? "text-emerald-400" : "text-muted-foreground/40"
          )}
        />
        {file ? (
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(file.size / 1024 / 1024).toFixed(1)} МБ
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Перетащите ZIP-файл сюда
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              или нажмите для выбора файла
            </p>
          </div>
        )}
      </div>

      {/* Category Selection */}
      <div className="space-y-1.5">
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

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Загрузка...</span>
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
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
            <div className="space-y-1">
              {result.articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <FileArchive className="h-3 w-3" />
                  {article.title}
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10"
                  >
                    в очереди
                  </Badge>
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
          disabled={!file || !categoryId || uploading}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {uploading ? "Загрузка..." : "Импортировать"}
        </Button>
        {file && (
          <Button
            variant="ghost"
            onClick={() => {
              setFile(null);
              setResult(null);
              setError(null);
            }}
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
