"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, FileText, Sparkles, Video, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

interface CreateArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArticleCreated: () => void;
}

type TabType = "manual" | "video";

// ── Slug generator (Cyrillic → Latin) ─────────────────────────

function generateSlug(title: string): string {
  const map: Record<string, string> = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  };
  return title
    .toLowerCase()
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Component ──────────────────────────────────────────────────

export function CreateArticleDialog({
  open,
  onOpenChange,
  onArticleCreated,
}: CreateArticleDialogProps) {
  const [tab, setTab] = useState<TabType>("manual");

  // Manual tab state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Video tab state
  const [videoTabUrl, setVideoTabUrl] = useState("");
  const [videoTabTitle, setVideoTabTitle] = useState("");
  const [videoCreating, setVideoCreating] = useState(false);
  const [videoProgress, setVideoProgress] = useState("");

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSummary("");
      setContent("");
      setTags("");
      setVideoUrl("");
      setPdfUrl("");
      setVideoTabUrl("");
      setVideoTabTitle("");
      setVideoProgress("");
      setTab("manual");
    }
  }, [open]);

  // ── Manual submit ──
  const handleSubmit = async () => {
    if (!title.trim()) return;

    setCreating(true);

    try {
      const slug = generateSlug(title.trim()) || `article-${Date.now()}`;

      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Detect if this is a video article (YouTube, Rutube, VK, Yandex Disk)
      function isVideoSource(url: string): boolean {
        if (!url) return false;
        try {
          const hostname = new URL(url).hostname.toLowerCase();
          return hostname.includes("youtube.com") || hostname.includes("youtu.be") ||
            hostname.includes("rutube.ru") || hostname.includes("vk.com") ||
            hostname.includes("vkvideo") || hostname.includes("disk.yandex") ||
            hostname.includes("yandex");
        } catch { return false; }
      }
      const isVideo = isVideoSource(videoUrl.trim());

      const body: Record<string, unknown> = {
        title: title.trim(),
        slug,
        spaceId: null, // AI auto-categorizes
        summary: summary.trim() || null,
        content: content.trim() || (isVideo ? "*Видеоматериал. Основной контент — видеоурок.*" : null),
        tags: tagsArray.length > 0 ? tagsArray : null,
        videoUrl: videoUrl.trim() || null,
        pdfUrl: pdfUrl.trim() || null,
        sourceType: isVideo ? "video" : undefined,
        isPublished: isVideo ? true : undefined,
        status: isVideo ? "done" : undefined,
      };

      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const article = await res.json();

        if (isVideo) {
          toast.success("Видео-статья создана", {
            description: `"${title.trim()}" добавлена и опубликована. AI дополнительно обработает метаданные...`,
          });
        } else {
          toast.success("Статья создана", {
            description: `"${title.trim()}" добавлена в библиотеку. Начинаю AI-обработку...`,
          });
        }

        // Fire-and-forget AI processing
        const articleId = article.id;
        const processChain = async () => {
          try {
            try {
              await fetch("/api/knowledge/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ensure-queue-items", articleId }),
              });
            } catch {}
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "metadata" }),
            });
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "glossary" }),
            });
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "graph" }),
            });
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "course" }),
            });
          } catch (err) {
            console.error("[CreateArticle] AI processing chain failed:", err);
          }
        };
        processChain();

        onArticleCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка создания статьи");
      }
    } catch {
      toast.error("Не удалось создать статью");
    } finally {
      setCreating(false);
    }
  };

  // ── Video tab submit (YouTube→AI article pipeline) ──
  const handleVideoSubmit = async () => {
    if (!videoTabUrl.trim()) return;

    setVideoCreating(true);
    setVideoProgress("Извлечение содержания видео...");

    try {
      const res = await fetch("/api/knowledge/ai/video-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoTabUrl.trim(),
          title: videoTabTitle.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Видео-статья создана!", {
          description: `"${data.article?.title || "Видео-урок"}" — AI сгенерировал статью, квиз и практику из видео`,
        });
        onArticleCreated();
        onOpenChange(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка создания видео-статьи");
      }
    } catch {
      toast.error("Не удалось создать видео-статью");
    } finally {
      setVideoCreating(false);
      setVideoProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111118] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Plus className="h-5 w-5 text-emerald-400" />
            Создать статью
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Выберите способ создания статьи
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setTab("manual")}
            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === "manual"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <FileText className="h-4 w-4" />
            Вручную
          </button>
          <button
            onClick={() => setTab("video")}
            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === "video"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Video className="h-4 w-4" />
            Из видео
          </button>
        </div>

        {/* ── Manual Tab ── */}
        {tab === "manual" && (
          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Название <span className="text-red-400">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название статьи"
                className="bg-white/5 border-white/10"
              />
            </div>

            {/* AI auto-categorize badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <Sparkles className="h-3 w-3" />
              AI автоматически определит раздел и сложность
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Описание
              </label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Краткое описание статьи"
                className="bg-white/5 border-white/10 min-h-[70px] resize-none"
                rows={2}
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Содержание
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Markdown-содержание статьи"
                className="bg-white/5 border-white/10 min-h-[160px] resize-y"
                rows={6}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Теги
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="AI, промпт, LLM (через запятую)"
                className="bg-white/5 border-white/10"
              />
            </div>

            {/* Video URL & PDF URL — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">
                  Видео URL
                </label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">
                  PDF URL
                </label>
                <Input
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* AI note */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
              <Sparkles className="h-3 w-3 text-emerald-400/60" />
              После создания AI автоматически определит раздел, извлечёт термины, создаст квиз и практическое задание
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={creating}
                className="text-muted-foreground hover:bg-white/5"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={creating || !title.trim()}
                className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1.5"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {creating ? "Создание..." : "Создать статью"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Video Tab (YouTube→AI) ── */}
        {tab === "video" && (
          <div className="space-y-4 py-2">
            {/* Video URL */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Ссылка на видео <span className="text-red-400">*</span>
              </label>
              <Input
                value={videoTabUrl}
                onChange={(e) => setVideoTabUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... или https://rutube.ru/..."
                className="bg-white/5 border-white/10"
              />
            </div>

            {/* Optional title */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Название <span className="text-muted-foreground/40">(необязательно — AI определит)</span>
              </label>
              <Input
                value={videoTabTitle}
                onChange={(e) => setVideoTabTitle(e.target.value)}
                placeholder="AI определит название автоматически"
                className="bg-white/5 border-white/10"
              />
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Как это работает
              </h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>AI извлекает содержание видео (субтитры/описание)</li>
                <li>Генерирует полноценную статью с заголовками и примерами</li>
                <li>Создаёт квиз из 5+ вопросов и практическое задание</li>
                <li>Автоматически определяет раздел и сложность</li>
                <li>Статья публикуется сразу с встроенным видео</li>
              </ol>
            </div>

            {/* Supported platforms */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Поддержка:</span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">YouTube</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Rutube</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">VK Видео</span>
            </div>

            {/* Progress indicator */}
            {videoCreating && videoProgress && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {videoProgress}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={videoCreating}
                className="text-muted-foreground hover:bg-white/5"
              >
                Отмена
              </Button>
              <Button
                onClick={handleVideoSubmit}
                disabled={videoCreating || !videoTabUrl.trim()}
                className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 gap-1.5"
              >
                {videoCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                {videoCreating ? "Создание из видео..." : "Создать из видео"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
