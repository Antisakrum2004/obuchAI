"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  Search,
  FileText,
  Video,
  FileIcon,
  Presentation,
  ExternalLink,
  Clock,
  Eye,
  Sparkles,
  Upload,
  Cpu,
  Filter,
  Pencil,
  Check,
  X,
  Trash2,
  Tag,
  Loader2,
  Send,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/user-store";
import { useSession } from "next-auth/react";
import { ProcessingQueue } from "@/components/knowledge/processing-queue";
import { BulkUpload } from "@/components/knowledge/bulk-upload";
import { ZipUpload } from "@/components/knowledge/zip-upload";
import { CreateArticleDialog } from "@/components/knowledge/create-article-dialog";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

interface MaterialArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string | null;
  viewCount: number;
  categoryId: string;
  isPublished: boolean;
  createdAt: string;
  categoryName?: string;
  spaceName?: string;
  spaceSlug?: string;
  spaceIcon?: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  pptxUrl?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  status?: string;
  aiGenerated?: boolean;
  difficulty?: string | null;
  estimatedTime?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "border-white/10 text-muted-foreground bg-white/5" },
  processing: { label: "Обработка", color: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
  done: { label: "Готово", color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  error: { label: "Ошибка", color: "border-red-500/30 text-red-400 bg-red-500/10" },
};

const sourceTypeConfig: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "border-red-500/30 text-red-400 bg-red-500/10" },
  rutube: { label: "Rutube", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  vk: { label: "VK Видео", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  yandex_disk: { label: "Яндекс Диск", color: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" },
  direct: { label: "Прямая ссылка", color: "border-white/10 text-muted-foreground bg-white/5" },
  other: { label: "Другое", color: "border-white/10 text-muted-foreground bg-white/5" },
};

const difficultyOptions = [
  { value: "easy", label: "Легко" },
  { value: "medium", label: "Средне" },
  { value: "hard", label: "Сложно" },
];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function parseTagsList(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Editable Article Card ─────────────────────────────────────

function EditableArticleCard({
  article,
  isAdmin,
  onUpdate,
  onDelete,
  onPublishWithoutAi,
}: {
  article: MaterialArticle;
  isAdmin: boolean;
  onUpdate: (id: string, fields: Partial<MaterialArticle>) => void;
  onDelete: (id: string) => void;
  onPublishWithoutAi: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editTitle, setEditTitle] = useState(article.title);
  const [editSummary, setEditSummary] = useState(article.summary || "");
  const [editTagsStr, setEditTagsStr] = useState(
    parseTagsList(article.tags).join(", ")
  );
  const [editDifficulty, setEditDifficulty] = useState(article.difficulty || "");

  const handleStartEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTitle(article.title);
    setEditSummary(article.summary || "");
    setEditTagsStr(parseTagsList(article.tags).join(", "));
    setEditDifficulty(article.difficulty || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagsArray = editTagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        title: editTitle.trim(),
        summary: editSummary.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        difficulty: editDifficulty || null,
      };

      const res = await fetch(
        `/api/knowledge/articles/${encodeURIComponent(article.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        toast.success("Статья обновлена");
        onUpdate(article.id, {
          title: editTitle.trim(),
          summary: editSummary.trim() || null,
          tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
          difficulty: editDifficulty || null,
        });
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка сохранения");
      }
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(
        `/api/knowledge/articles/${encodeURIComponent(article.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Статья удалена");
        onDelete(article.id);
      } else {
        toast.error("Ошибка удаления");
      }
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const handlePublishWithoutAi = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPublishing(true);
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-without-ai", articleId: article.id }),
      });
      if (res.ok) {
        toast.success("Опубликовано без AI-обработки");
        onPublishWithoutAi(article.id);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Ошибка публикации");
      }
    } catch {
      toast.error("Не удалось опубликовать");
    } finally {
      setPublishing(false);
    }
  };

  if (editing) {
    return (
      <div className="glass rounded-xl p-5 border border-emerald-500/20 h-full flex flex-col">
        <div className="space-y-3 flex-1">
          {/* Title */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Название
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-white/5 border-white/10 text-sm h-8"
              placeholder="Название статьи"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Описание
            </label>
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="bg-white/5 border-white/10 text-xs min-h-[60px] resize-none"
              placeholder="Краткое описание статьи"
              rows={2}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Теги (через запятую)
            </label>
            <Input
              value={editTagsStr}
              onChange={(e) => setEditTagsStr(e.target.value)}
              className="bg-white/5 border-white/10 text-xs h-8"
              placeholder="AI, промпт, LLM"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Сложность
            </label>
            <Select value={editDifficulty || "_none"} onValueChange={(v) => setEditDifficulty(v === "_none" ? "" : v)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-xs h-8">
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
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !editTitle.trim()}
            className="h-7 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Сохранить
          </Button>
          <Button
            size="sm"
            onClick={handleCancel}
            className="h-7 text-xs bg-white/5 border border-white/10 hover:bg-white/10 gap-1"
          >
            <X className="h-3 w-3" />
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/knowledge/article/${article.id}`}
      className="block"
    >
      <div className="glass rounded-xl p-5 border-white/5 hover:border-emerald-500/20 transition-all duration-200 h-full group relative">
        {/* Admin edit/delete — top right, visible on hover */}
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={handleStartEdit}
              className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors text-muted-foreground"
              title="Редактировать"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors text-muted-foreground"
                  title="Удалить"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#111118] border-white/10" onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Удалить статью?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    Статья &laquo;{article.title}&raquo; будет удалена без возможности восстановления. Все привязанные файлы также будут удалены.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 text-foreground hover:bg-white/10">
                    Отмена
                  </AlertDialogCancel>
                        <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDelete(); }}
                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <h3 className="font-semibold text-sm group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2 pr-12">
          {article.title}
        </h3>

        {article.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {article.summary}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.status && article.status !== "done" && statusConfig[article.status] && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusConfig[article.status].color)}>
              {statusConfig[article.status].label}
            </Badge>
          )}
          {article.sourceType && sourceTypeConfig[article.sourceType] && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sourceTypeConfig[article.sourceType].color)}>
              {sourceTypeConfig[article.sourceType].label}
            </Badge>
          )}
          {article.aiGenerated && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              AI
            </Badge>
          )}
          {article.tags && parseTagsList(article.tags).length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              <Tag className="h-2.5 w-2.5 text-muted-foreground/50" />
              {parseTagsList(article.tags).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-muted-foreground/70">
                  {tag}
                </Badge>
              ))}
              {parseTagsList(article.tags).length > 3 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-muted-foreground/50">
                  +{parseTagsList(article.tags).length - 3}
                </Badge>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3 text-muted-foreground">
          {article.videoUrl && (
            <span className="flex items-center gap-1 text-[11px]" title="Есть видео">
              <Video className="h-3 w-3" />
            </span>
          )}
          {article.pdfUrl && (
            <span className="flex items-center gap-1 text-[11px]" title="Есть PDF">
              <FileIcon className="h-3 w-3" />
            </span>
          )}
          {article.pptxUrl && (
            <span className="flex items-center gap-1 text-[11px]" title="Есть презентация">
              <Presentation className="h-3 w-3" />
            </span>
          )}
          {article.sourceUrl && (
            <span className="flex items-center gap-1 text-[11px]" title="Есть источник">
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Publish without AI — always visible for pending articles */}
        {isAdmin && article.status && article.status !== "done" && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <button
              onClick={handlePublishWithoutAi}
              disabled={publishing}
              className="w-full flex items-center justify-center gap-2 h-8 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors text-xs font-medium disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Опубликовать без AI
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
          {article.categoryName && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {article.categoryName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {article.viewCount}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(article.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Page Component ─────────────────────────────────────────────

export default function MaterialsPage() {
  const [articles, setArticles] = useState<MaterialArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [showZipUpload, setShowZipUpload] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [showCreateArticle, setShowCreateArticle] = useState(false);

  // Admin detection — use destructuring like other pages
  const { role: storeRole } = useUserStore();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const sessionRole = (session?.user as Record<string, unknown> | undefined)?.role as string | undefined;
  const [apiAdmin, setApiAdmin] = useState(false);
  const isAdmin = storeRole === "admin" || sessionRole === "admin" || apiAdmin;

  useEffect(() => {
    if (storeRole === "admin" || sessionRole === "admin") return;
    fetch("/api/user/stats")
      .then((r) => {
        if (!r.ok) return null;
        try { return r.json(); } catch { return null; }
      })
      .then((data) => {
        if (data && typeof data === "object" && (data as Record<string, unknown>).role === "admin") {
          setApiAdmin(true);
        }
      })
      .catch(() => {});
  }, [storeRole, sessionRole]);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/articles?all=true&recent=100");
      if (res.ok) {
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const filtered = articles.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (sourceTypeFilter !== "all" && a.sourceType !== sourceTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesTitle = a.title?.toLowerCase().includes(q);
      const matchesSummary = a.summary?.toLowerCase().includes(q);
      const matchesTags = a.tags?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesSummary && !matchesTags) return false;
    }
    return true;
  });

  const pendingCount = articles.filter((a) => a.status === "pending").length;

  // Auto-trigger AI processing for pending articles when page loads (if AI is configured)
  useEffect(() => {
    if (!isAdmin || pendingCount === 0) return;

    let cancelled = false;

    const autoProcess = async () => {
      // Check if AI is configured
      try {
        const statusRes = await fetch("/api/knowledge/ai/status");
        const statusData = await statusRes.json();
        if (!statusData.available || cancelled) return;

        // Get pending queue items
        const queueRes = await fetch("/api/knowledge/queue?status=pending");
        if (!queueRes.ok || cancelled) return;
        const queueItems = await queueRes.json();
        if (!Array.isArray(queueItems) || queueItems.length === 0) return;

        console.log(`[Auto-process] Found ${queueItems.length} pending queue items, starting processing...`);

        // Group by articleId and process each article sequentially
        const articleIds = [...new Set(queueItems.map((item: { articleId: string }) => item.articleId))];

        for (const articleId of articleIds) {
          if (cancelled) break;

          // Get queue items for this article
          const articleItems = queueItems.filter((item: { articleId: string }) => item.articleId === articleId);
          const types = articleItems.map((item: { type: string }) => {
            const map: Record<string, string> = {
              content_extract: "content",
              ai_metadata: "metadata",
              glossary_extract: "glossary",
              graph_build: "graph",
            };
            return map[item.type] || "metadata";
          });

          for (const type of types) {
            if (cancelled) break;
            try {
              await fetch("/api/knowledge/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ articleId, type }),
              });
            } catch {
              // Silently continue on error
            }
          }
        }

        // Refresh articles after auto-processing
        if (!cancelled) fetchArticles();
      } catch {
        // Silently fail
      }
    };

    autoProcess();

    return () => { cancelled = true; };
  }, [isAdmin, pendingCount, fetchArticles]);

  // Handle inline update from card
  const handleArticleUpdate = useCallback((id: string, fields: Partial<MaterialArticle>) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...fields } : a))
    );
  }, []);

  // Handle inline delete from card
  const handleArticleDelete = useCallback((id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Handle publish without AI
  const handlePublishWithoutAi = useCallback((id: string) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "done", isPublished: true } : a
      )
    );
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl flex items-center gap-3">
                <Archive className="h-7 w-7 text-emerald-400" />
                Библиотека материалов
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Управление статьями — загрузка, обработка, редактирование
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={() => setShowQueue(!showQueue)}
                  className="bg-white/5 text-foreground border border-white/10 hover:bg-white/10"
                  size="sm"
                >
                  <Cpu className="h-4 w-4 mr-1" />
                  Очередь
                  {pendingCount > 0 && (
                    <Badge className="ml-1.5 bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                      {pendingCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setShowBulkUpload(!showBulkUpload)}
                  className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Загрузить файлы
                </Button>
                <Button
                  onClick={() => setShowZipUpload(!showZipUpload)}
                  className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Импорт ZIP
                </Button>
                <Button
                  onClick={() => setShowCreateArticle(true)}
                  className="bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Создать статью
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Processing Queue */}
        {isAdmin && showQueue && (
          <ProcessingQueue onQueueChange={fetchArticles} />
        )}

        {/* Bulk File Upload */}
        {isAdmin && showBulkUpload && (
          <BulkUpload
            onUploadComplete={() => {
              fetchArticles();
              setShowQueue(true);
              setTimeout(() => setShowBulkUpload(false), 2000);
            }}
          />
        )}

        {/* ZIP Upload */}
        {isAdmin && showZipUpload && (
          <ZipUpload
            onUploadComplete={() => {
              fetchArticles();
              setShowZipUpload(false);
            }}
          />
        )}

        {/* Create Article Dialog */}
        {isAdmin && (
          <CreateArticleDialog
            open={showCreateArticle}
            onOpenChange={setShowCreateArticle}
            onArticleCreated={() => {
              fetchArticles();
              setShowQueue(true);
              setShowCreateArticle(false);
            }}
          />
        )}

        {/* Filter Bar */}
        <div className="glass rounded-xl p-4 border-white/5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, описанию, тегам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/5 border-white/10 pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 w-[140px]">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="processing">Обработка</SelectItem>
                  <SelectItem value="done">Готово</SelectItem>
                  <SelectItem value="error">Ошибка</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 w-[150px]">
                  <SelectValue placeholder="Источник" />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  <SelectItem value="all">Все источники</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="rutube">Rutube</SelectItem>
                  <SelectItem value="yandex_disk">Яндекс Диск</SelectItem>
                  <SelectItem value="direct">Прямая ссылка</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Articles List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-xl p-5 border-white/5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Archive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              {search || statusFilter !== "all" || sourceTypeFilter !== "all"
                ? "Ничего не найдено"
                : "Библиотека пуста"}
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search || statusFilter !== "all" || sourceTypeFilter !== "all"
                ? "Попробуйте изменить фильтры"
                : "Материалы будут добавлены позже"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article) => (
              <EditableArticleCard
                key={article.id}
                article={article}
                isAdmin={isAdmin}
                onUpdate={handleArticleUpdate}
                onDelete={handleArticleDelete}
                onPublishWithoutAi={handlePublishWithoutAi}
              />
            ))}
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div className="text-center text-xs text-muted-foreground/40 pt-2">
            Всего материалов: {articles.length} · Показано: {filtered.length}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
