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
import {
  Plus,
  Loader2,
  FileText,
  Sparkles,
  Video,
  Youtube,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Video Source Detection ──────────────────────────────────────

function detectSourceType(url: string): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("rutube.ru")) return "rutube";
    if (hostname.includes("vk.com") || hostname.includes("vkvideo")) return "vk";
    if (hostname.includes("disk.yandex") || hostname.includes("yandex")) return "yandex_disk";
    if (hostname.endsWith(".mp4") || url.endsWith(".mp4")) return "direct";
    return "other";
  } catch {
    return null;
  }
}

const sourceTypeLabels: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "border-red-500/30 text-red-400 bg-red-500/10" },
  rutube: { label: "Rutube", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  vk: { label: "VK Видео", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  yandex_disk: { label: "Яндекс", color: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" },
  direct: { label: "MP4", color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  other: { label: "Ссылка", color: "border-white/10 text-muted-foreground" },
};

// ── Types ──────────────────────────────────────────────────────

interface CreateArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArticleCreated: () => void;
}

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

// ── Tab type ──────────────────────────────────────────────────

type CreateMode = "manual" | "video";

// ── Component ──────────────────────────────────────────────────

export function CreateArticleDialog({
  open,
  onOpenChange,
  onArticleCreated,
}: CreateArticleDialogProps) {
  const [mode, setMode] = useState<CreateMode>("manual");

  // Manual form fields
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Video form fields
  const [videoSourceUrl, setVideoSourceUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCreating, setVideoCreating] = useState(false);
  const [videoStep, setVideoStep] = useState<"input" | "processing" | "done">("input");
  const [createdArticleId, setCreatedArticleId] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSummary("");
      setContent("");
      setTags("");
      setVideoUrl("");
      setPdfUrl("");
      setVideoSourceUrl("");
      setVideoTitle("");
      setVideoStep("input");
      setCreatedArticleId(null);
      setMode("manual");
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

      const body: Record<string, unknown> = {
        title: title.trim(),
        slug,
        spaceId: null, // AI auto-categorizes
        summary: summary.trim() || null,
        content: content.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        difficulty: null, // AI auto-determines
        videoUrl: videoUrl.trim() || null,
        pdfUrl: pdfUrl.trim() || null,
        sourceType: videoUrl.trim() ? detectSourceType(videoUrl.trim()) : null,
      };

      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const article = await res.json();
        toast.success("Статья создана", {
          description: `"${title.trim()}" добавлена в библиотеку. Начинаю AI-обработку...`,
        });

        // Fire-and-forget AI processing — sequential chain for best results
        const articleId = article.id;
        const processChain = async () => {
          try {
            try {
              await fetch("/api/knowledge/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ensure-queue-items", articleId }),
              });
            } catch { /* Non-critical */ }
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
        onOpenChange(false);
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

  // ── Video submit ──
  const handleVideoSubmit = async () => {
    if (!videoSourceUrl.trim()) return;

    const sourceType = detectSourceType(videoSourceUrl.trim());
    if (sourceType !== "youtube") {
      toast.error("Пока поддерживаются только ссылки YouTube");
      return;
    }

    setVideoCreating(true);
    setVideoStep("processing");

    try {
      const res = await fetch("/api/knowledge/ai/video-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoSourceUrl.trim(),
          title: videoTitle.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedArticleId(data.articleId);
        setVideoStep("done");
        toast.success("Статья из видео создана!", {
          description: `"${data.title}" — AI обрабатывает содержание...`,
        });
        onArticleCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка создания статьи из видео");
        setVideoStep("input");
      }
    } catch {
      toast.error("Не удалось обработать видео");
      setVideoStep("input");
    } finally {
      setVideoCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111118] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-emerald-400" />
            Создать материал
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Выберите способ создания: вручную или из видео
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/5">
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
              mode === "manual"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Вручную
          </button>
          <button
            onClick={() => setMode("video")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
              mode === "video"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <Youtube className="h-3.5 w-3.5" />
            Из видео
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 ml-0.5">
              AI
            </Badge>
          </button>
        </div>

        {/* ── Manual Mode ── */}
        {mode === "manual" && (
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

            {/* Space — AI auto-determines */}
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
                <div className="flex items-center gap-2">
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube, Rutube, VK, MP4..."
                    className="bg-white/5 border-white/10"
                  />
                  {videoUrl && (() => {
                    const type = detectSourceType(videoUrl);
                    if (!type) return null;
                    const config = sourceTypeLabels[type] || sourceTypeLabels.other;
                    return (
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 shrink-0", config.color)}>
                        <Video className="h-2.5 w-2.5 mr-0.5" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                </div>
                {videoUrl && detectSourceType(videoUrl) && (
                  <p className="text-[10px] text-muted-foreground">Видео появится в разделе «Материалы» при прохождении курса</p>
                )}
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

        {/* ── Video Mode ── */}
        {mode === "video" && (
          <div className="space-y-4 py-2">
            {videoStep === "input" && (
              <>
                {/* How it works */}
                <div className="rounded-xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-orange-500/10 border border-red-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20 shrink-0">
                      <Youtube className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground">Как это работает</h3>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold shrink-0">1</div>
                          Вставьте ссылку на YouTube видео
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold shrink-0">2</div>
                          AI извлечёт содержание и создаст статью-конспект
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold shrink-0">3</div>
                          Автоматически: раздел, глоссарий, квиз, практика
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* YouTube URL */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Ссылка на YouTube видео <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={videoSourceUrl}
                      onChange={(e) => setVideoSourceUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="bg-white/5 border-white/10"
                    />
                    {videoSourceUrl && (() => {
                      const type = detectSourceType(videoSourceUrl);
                      if (type !== "youtube") {
                        return (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
                            Не YouTube
                          </Badge>
                        );
                      }
                      return (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-red-500/30 text-red-400 bg-red-500/10">
                          <Youtube className="h-2.5 w-2.5 mr-0.5" />
                          YouTube
                        </Badge>
                      );
                    })()}
                  </div>
                  {videoSourceUrl && detectSourceType(videoSourceUrl) && detectSourceType(videoSourceUrl) !== "youtube" && (
                    <p className="text-[10px] text-yellow-400/80">Пока поддерживаются только ссылки YouTube. Для других видео используйте ручной режим.</p>
                  )}
                </div>

                {/* Optional title */}
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Название (необязательно)
                  </label>
                  <Input
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="AI определит название автоматически"
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-[10px] text-muted-foreground/60">Если не указать — AI подберёт название из содержания видео</p>
                </div>

                {/* AI auto-badges */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Раздел — AI
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Сложность — AI
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Глоссарий — AI
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Квиз + Практика — AI
                  </div>
                </div>

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
                    disabled={videoCreating || !videoSourceUrl.trim() || detectSourceType(videoSourceUrl) !== "youtube"}
                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 gap-1.5"
                  >
                    {videoCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Youtube className="h-4 w-4" />
                    )}
                    {videoCreating ? "Обработка видео..." : "Создать из видео"}
                  </Button>
                </DialogFooter>
              </>
            )}

            {videoStep === "processing" && (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
                    <Youtube className="h-8 w-8 text-red-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-medium">Обрабатываю видео...</h3>
                  <p className="text-xs text-muted-foreground">
                    AI извлекает содержание и создаёт статью
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  Это может занять 1-2 минуты
                </div>
              </div>
            )}

            {videoStep === "done" && (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-medium text-emerald-400">Статья из видео создана!</h3>
                  <p className="text-xs text-muted-foreground">
                    AI обрабатывает содержание, глоссарий, квиз и практику в фоне
                  </p>
                </div>
                {createdArticleId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      window.location.href = `/knowledge/article/${createdArticleId}`;
                    }}
                    className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Открыть статью
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
