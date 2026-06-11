"use client";

import { useState, useEffect, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

interface CreateArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArticleCreated: () => void;
}

interface Space {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
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
  const [spaceId, setSpaceId] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch spaces when dialog opens
  const fetchSpaces = useCallback(async () => {
    setLoadingSpaces(true);
    try {
      const res = await fetch("/api/knowledge/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSpaces();
    }
  }, [open, fetchSpaces]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSpaceId("");
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
        spaceId: spaceId || null,
        summary: summary.trim() || null,
        content: content.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        difficulty: difficulty || null,
        videoUrl: videoUrl.trim() || null,
        pdfUrl: pdfUrl.trim() || null,
      };

      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const article = await res.json();
        toast.success("Статья создана", {
          description: `"${title.trim()}" добавлена в библиотеку`,
        });

        // Fire-and-forget AI processing — sequential chain for best results
        const articleId = article.id;
        const processChain = async () => {
          try {
            // Step 1: Metadata + Categorization (auto-assigns space if none)
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "metadata" }),
            });
            // Step 2: Glossary
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "glossary" }),
            });
            // Step 3: Graph
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "graph" }),
            });
            // Step 4: Course (Quiz + Practice)
            await fetch("/api/knowledge/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, type: "course" }),
            });
          } catch {
            // Silently fail — user can retry from queue
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

          {/* Space */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Раздел
              <span className="text-emerald-400/60 text-[10px] ml-1.5">(если не выбрать — AI определит автоматически)</span>
            </label>
            {loadingSpaces ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-white/5 border border-white/10 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Загрузка разделов...
              </div>
            ) : spaces.length === 0 ? (
              <div className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                AI автоматически создаст подходящий раздел
              </div>
            ) : (
              <Select value={spaceId || "_auto"} onValueChange={(v) => setSpaceId(v === "_auto" ? "" : v)}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Авто-определение AI" />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  <SelectItem value="_auto">🤖 Авто-определение AI</SelectItem>
                  {spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.icon || "📚"} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
