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

import { Plus, Loader2, FileText, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Space interface removed — AI auto-categorizes articles

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

// ── Difficulty options ─────────────────────────────────────────

const difficultyOptions = [
  { value: "easy", label: "Легко" },
  { value: "medium", label: "Средне" },
  { value: "hard", label: "Сложно" },
];

// ── Component ──────────────────────────────────────────────────

export function CreateArticleDialog({
  open,
  onOpenChange,
  onArticleCreated,
}: CreateArticleDialogProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Spaces fetch removed — AI auto-categorizes, no manual selection needed

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSummary("");
      setContent("");
      setTags("");
      setDifficulty("");
      setVideoUrl("");
      setPdfUrl("");
    }
  }, [open]);

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
        difficulty: difficulty || null,
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
            // Step 0: Create ALL queue entries upfront so auto-publish logic works correctly
            // (without this, auto-publish triggers after the first step completes)
            try {
              await fetch("/api/knowledge/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ensure-queue-items", articleId }),
              });
            } catch {
              // Non-critical — queue items will be created on-the-fly as fallback
            }
            // Step 1: Metadata + Categorization (auto-assigns space if none)
            const metaRes = await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "metadata" }),
            });
            console.log(`[CreateArticle] metadata: ${metaRes.status}`);
            // Step 2: Glossary
            const glossRes = await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "glossary" }),
            });
            console.log(`[CreateArticle] glossary: ${glossRes.status}`);
            // Step 3: Graph
            const graphRes = await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "graph" }),
            });
            console.log(`[CreateArticle] graph: ${graphRes.status}`);
            // Step 4: Course (Quiz + Practice)
            const courseRes = await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "course" }),
            });
            console.log(`[CreateArticle] course: ${courseRes.status}`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111118] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-emerald-400" />
            Создать статью
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Заполните поля для создания новой статьи вручную
          </DialogDescription>
        </DialogHeader>

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

          {/* Space — AI auto-determines, show info badge */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Раздел
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <Sparkles className="h-3 w-3" />
              AI автоматически определит подходящий раздел
            </div>
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

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Сложность
            </label>
            <Select value={difficulty || "_none"} onValueChange={(v) => setDifficulty(v === "_none" ? "" : v)}>
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue placeholder="Не указана" />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-white/10">
                <SelectItem value="_none">Не указана</SelectItem>
                {difficultyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>

        {/* AI note */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 pt-1">
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
      </DialogContent>
    </Dialog>
  );
}
