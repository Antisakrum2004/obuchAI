"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  BookOpen,
  GitBranch,
  Zap,
  ArrowRight,
  Settings,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProcessingQueueProps {
  className?: string;
  onQueueChange?: () => void;
}

interface QueueItem {
  id: string;
  type: string;
  status: string;
  articleId: string;
  inputData: string | null;
  result: string | null;
  error: string | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  articleTitle: string | null;
}

/** Grouped view: one card per article, with processing types inside */
interface ArticleGroup {
  articleId: string;
  articleTitle: string;
  items: QueueItem[];
  overallStatus: "pending" | "processing" | "done" | "error" | "mixed";
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; badgeColor: string }
> = {
  pending: {
    label: "Ожидает",
    icon: Clock,
    color: "text-muted-foreground",
    badgeColor: "border-white/10 text-muted-foreground bg-white/5",
  },
  processing: {
    label: "Обработка",
    icon: Loader2,
    color: "text-amber-400",
    badgeColor: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  },
  done: {
    label: "Готово",
    icon: CheckCircle2,
    color: "text-emerald-400",
    badgeColor: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  },
  error: {
    label: "Ошибка",
    icon: AlertCircle,
    color: "text-red-400",
    badgeColor: "border-red-500/30 text-red-400 bg-red-500/10",
  },
};

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  zip_import: { label: "ZIP импорт", icon: Cpu, color: "text-muted-foreground" },
  content_extract: { label: "Извлечение", icon: FileText, color: "text-cyan-400" },
  ai_metadata: { label: "Метаданные", icon: Sparkles, color: "text-blue-400" },
  glossary_extract: { label: "Глоссарий", icon: BookOpen, color: "text-purple-400" },
  graph_build: { label: "Граф знаний", icon: GitBranch, color: "text-amber-400" },
};

// AI processing types with icons — THIS IS THE ORDER they run in
const aiTypes = [
  { type: "content", queueType: "content_extract", label: "Извлечь текст", icon: FileText, color: "text-cyan-400" },
  { type: "metadata", queueType: "ai_metadata", label: "Метаданные", icon: Sparkles, color: "text-blue-400" },
  { type: "glossary", queueType: "glossary_extract", label: "Глоссарий", icon: BookOpen, color: "text-purple-400" },
  { type: "graph", queueType: "graph_build", label: "Граф знаний", icon: GitBranch, color: "text-amber-400" },
] as const;

function computeOverallStatus(items: QueueItem[]): ArticleGroup["overallStatus"] {
  const statuses = new Set(items.map((i) => i.status));
  if (statuses.size === 1) return statuses.values().next().value as ArticleGroup["overallStatus"];
  if (statuses.has("error") && !statuses.has("processing") && !statuses.has("pending"))
    return "error";
  if (statuses.has("processing")) return "processing";
  if (statuses.has("pending")) return "mixed";
  return "done";
}

export function ProcessingQueue({ className, onQueueChange }: ProcessingQueueProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null); // null = checking

  const fetchQueue = useCallback(async () => {
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/knowledge/queue${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Check AI availability on mount
  useEffect(() => {
    fetch("/api/knowledge/ai/status")
      .then((res) => res.json())
      .then((data) => setAiAvailable(data.available))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 5 seconds while items are processing
  useEffect(() => {
    const hasProcessing = items.some(
      (item) => item.status === "pending" || item.status === "processing"
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchQueue();
      onQueueChange?.();
    }, 5000);

    return () => clearInterval(interval);
  }, [items, fetchQueue, onQueueChange]);

  // ── COMPUTED VALUES ──

  const groups = useMemo<ArticleGroup[]>(() => {
    const result: ArticleGroup[] = [];
    const groupMap = new Map<string, ArticleGroup>();
    for (const item of items) {
      const existing = groupMap.get(item.articleId);
      if (existing) {
        existing.items.push(item);
      } else {
        const group: ArticleGroup = {
          articleId: item.articleId,
          articleTitle: item.articleTitle || item.articleId.slice(0, 12),
          items: [item],
          overallStatus: "pending",
        };
        groupMap.set(item.articleId, group);
        result.push(group);
      }
    }
    for (const g of result) {
      g.overallStatus = computeOverallStatus(g.items);
    }
    return result;
  }, [items]);

  const pendingGroupCount = useMemo(
    () => groups.filter((g) => g.overallStatus === "pending" || g.overallStatus === "mixed").length,
    [groups]
  );

  const errorGroupCount = useMemo(
    () => groups.filter((g) => g.overallStatus === "error").length,
    [groups]
  );

  const hasActiveItems = useMemo(
    () => items.some((item) => item.status === "pending" || item.status === "processing"),
    [items]
  );

  // ── HANDLERS ──

  const handleStartProcessing = useCallback(async (articleId: string, type: string) => {
    if (aiAvailable === false) {
      toast.error("AI-сервис не настроен. Добавьте OPENROUTER_API_KEY в Vercel Dashboard.");
      return;
    }
    setProcessing(`${articleId}-${type}`);
    try {
      const res = await fetch("/api/knowledge/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, type }),
      });
      if (res.status === 503) {
        const data = await res.json();
        toast.error(data.details || data.error);
        setAiAvailable(false);
      }
      fetchQueue();
      onQueueChange?.();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  }, [aiAvailable, fetchQueue, onQueueChange]);

  /**
   * "Все" button — Process all 4 types for ONE article sequentially.
   * Flow:
   * 1. Ensure all queue items exist (create missing ones)
   * 2. Process each type sequentially: content → metadata → glossary → graph
   * 3. After all done, article auto-publishes with content, glossary, and graph
   */
  const handleStartAllForArticle = useCallback(async (articleId: string) => {
    if (aiAvailable === false) {
      toast.error("AI-сервис не настроен. Добавьте OPENROUTER_API_KEY в Vercel Dashboard.");
      return;
    }
    setProcessing(`${articleId}-all`);
    try {
      // Step 1: Ensure all queue items exist for this article
      await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure-queue-items", articleId }),
      });

      // Step 2: Process each type sequentially
      for (const { type } of aiTypes) {
        const res = await fetch("/api/knowledge/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type }),
        });
        if (res.status === 503) {
          const data = await res.json();
          toast.error(data.details || data.error);
          setAiAvailable(false);
          break;
        }
        // If a step fails, stop the chain
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn(`[Queue] Step '${type}' failed for ${articleId}:`, data.error);
          break;
        }
      }
      fetchQueue();
      onQueueChange?.();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  }, [aiAvailable, fetchQueue, onQueueChange]);

  /**
   * "Обработать всё" — Process ALL pending/error articles at once.
   * For each article: ensure queue items → process all types sequentially.
   * After processing, articles auto-publish with extracted content, glossary, and knowledge graph.
   */
  const handleProcessAllPending = useCallback(async () => {
    if (aiAvailable === false) {
      toast.error("AI-сервис не настроен. Добавьте OPENROUTER_API_KEY в Vercel Dashboard.");
      return;
    }
    const pendingArticles = groups.filter(
      (g) => g.overallStatus === "pending" || g.overallStatus === "mixed" || g.overallStatus === "error"
    );
    if (pendingArticles.length === 0) return;

    setProcessingAll(true);
    toast.info(`Начинаем обработку ${pendingArticles.length} статей...`);

    let successCount = 0;
    let errorCount = 0;
    let stopped = false;

    for (const group of pendingArticles) {
      if (stopped) break;
      try {
        // Ensure all queue items exist
        await fetch("/api/knowledge/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ensure-queue-items", articleId: group.articleId }),
        });

        // Process each type sequentially
        for (const { type } of aiTypes) {
          const res = await fetch("/api/knowledge/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: group.articleId, type }),
          });
          if (res.status === 503) {
            const data = await res.json();
            toast.error(data.details || data.error);
            setAiAvailable(false);
            stopped = true;
            break;
          }
          if (!res.ok) break; // Skip to next article on error
        }
        if (!stopped) successCount++;
      } catch {
        errorCount++;
      }
    }

    fetchQueue();
    onQueueChange?.();
    setProcessingAll(false);

    if (stopped) {
      toast.error("AI-сервис не настроен. Обработка остановлена.");
    } else if (errorCount === 0) {
      toast.success(`Обработано ${successCount} статей — статьи опубликованы в Базе знаний`);
    } else {
      toast.warning(`Обработано: ${successCount}, ошибок: ${errorCount}`);
    }
  }, [aiAvailable, groups, fetchQueue, onQueueChange]);

  /** Reset all error items back to pending */
  const handleResetErrors = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-errors" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchQueue();
        onQueueChange?.();
      }
    } catch {
      toast.error("Не удалось сбросить ошибки");
    }
  }, [fetchQueue, onQueueChange]);

  /** Create content_extract queue items for articles that have PDF but placeholder content */
  const handleCreateContentTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-content-tasks" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.createdCount > 0) {
          toast.success(data.message);
        } else {
          toast.info("Нет статей, которым нужно извлечь контент");
        }
        fetchQueue();
        onQueueChange?.();
      }
    } catch {
      toast.error("Не удалось создать задачи извлечения");
    }
  }, [fetchQueue, onQueueChange]);

  /** Clear all pending items from the queue */
  const handleClearPending = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-pending" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchQueue();
        onQueueChange?.();
      }
    } catch {
      toast.error("Не удалось очистить очередь");
    }
  }, [fetchQueue, onQueueChange]);

  /** Clear the entire queue (all statuses) */
  const handleClearAll = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-all" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchQueue();
        onQueueChange?.();
      }
    } catch {
      toast.error("Не удалось очистить очередь");
    }
  }, [fetchQueue, onQueueChange]);

  // ── KEYBOARD SHORTCUTS ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "l" || e.key === "L" || e.key === "д" || e.key === "Д") {
          e.preventDefault();
          const firstPending = groups.find(
            (g) => g.overallStatus === "pending" || g.overallStatus === "mixed"
          );
          if (firstPending) {
            handleStartProcessing(firstPending.articleId, "glossary");
          }
        }
        if (e.key === "k" || e.key === "K" || e.key === "л" || e.key === "Л") {
          e.preventDefault();
          if (pendingGroupCount > 0 && !processingAll && !processing) {
            handleProcessAllPending();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [groups, processing, processingAll, pendingGroupCount, handleStartProcessing, handleProcessAllPending]);

  // ── RENDER ──

  return (
    <div className={cn("glass rounded-xl p-5 border-white/5 space-y-4", className)}>
      {/* AI Not Configured Banner */}
      {aiAvailable === false && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/[0.08] border border-red-500/20 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-400">AI-сервис не настроен</p>
            <p className="text-xs text-muted-foreground mt-1">
              Для работы AI-обработки необходимо добавить переменные окружения в Vercel Dashboard:
            </p>
            <div className="mt-2 p-2 rounded bg-black/30 text-xs font-mono space-y-0.5">
              <p className="text-amber-400">OPENROUTER_API_KEY=<span className="text-muted-foreground">ваш_ключ</span></p>
              <p className="text-muted-foreground">OPENROUTER_MODEL=<span className="text-muted-foreground">google/gemini-2.5-flash-preview (по умолчанию)</span></p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <Settings className="h-3 w-3 inline" /> Vercel Dashboard → Project → Settings → Environment Variables
            </p>
          </div>
        </div>
      )}

      {/* Header with buttons */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          Очередь обработки
          {pendingGroupCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
              {pendingGroupCount}
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {/* Process All button */}
          {pendingGroupCount > 0 && (
            <Button
              size="sm"
              onClick={handleProcessAllPending}
              disabled={processingAll || !!processing}
              className="h-8 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1.5"
            >
              {processingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Обработать всё
            </Button>
          )}
          {/* Reset errors button */}
          {errorGroupCount > 0 && (
            <Button
              size="sm"
              onClick={handleResetErrors}
              className="h-8 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Сбросить ошибки
            </Button>
          )}
          {/* Find PDF button */}
          <Button
            size="sm"
            onClick={handleCreateContentTasks}
            className="h-8 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Найти PDF
          </Button>
          {/* Clear Queue — with confirmation */}
          {items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Очистить
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#111118] border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Очистить очередь?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    Все ожидающие и ошибочные задачи будут удалены из очереди. Статьи не удаляются — только задачи обработки.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 text-foreground hover:bg-white/10">
                    Отмена
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  >
                    Очистить всё
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 h-8 w-[130px] text-xs">
              <SelectValue placeholder="Фильтр" />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-white/10">
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="pending">Ожидает</SelectItem>
              <SelectItem value="processing">Обработка</SelectItem>
              <SelectItem value="done">Готово</SelectItem>
              <SelectItem value="error">Ошибка</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchQueue}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Queue items */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Очередь пуста — загрузите файлы для начала обработки
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {groups
            .filter((g) => {
              if (statusFilter === "all") return g.overallStatus !== "done"; // hide done by default (auto-cleaned)
              return g.overallStatus === statusFilter;
            })
            .map((group) => {
            const config = statusConfig[group.overallStatus] || statusConfig.pending;
            const Icon = config.icon;
            const hasPending = group.items.some((i) => i.status === "pending");
            const isProcessing = group.items.some((i) => i.status === "processing");
            const avgProgress = Math.round(
              group.items.reduce((sum, i) => sum + (i.progress || 0), 0) / group.items.length
            );
            const doneCount = group.items.filter((i) => i.status === "done").length;
            const totalCount = group.items.length;

            return (
              <div
                key={group.articleId}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  isProcessing
                    ? "bg-amber-500/[0.03] border-amber-500/20"
                    : group.overallStatus === "done"
                    ? "bg-emerald-500/[0.03] border-emerald-500/10"
                    : group.overallStatus === "error"
                    ? "bg-red-500/[0.03] border-red-500/10"
                    : "bg-white/[0.02] border-white/5"
                )}
              >
                {/* Article header */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      config.color,
                      isProcessing && "animate-spin"
                    )}
                  />
                  <span className="text-sm font-medium truncate flex-1">
                    {group.articleTitle}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {doneCount}/{totalCount}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] px-1.5 py-0 shrink-0", config.badgeColor)}
                  >
                    {isProcessing ? "Обработка" : config.label}
                  </Badge>
                </div>

                {/* Processing types inside the card */}
                <div className="space-y-1.5 ml-6">
                  {group.items.map((item) => {
                    const typeInfo = typeLabels[item.type];
                    const TypeIcon = typeInfo?.icon || Cpu;
                    const itemConfig = statusConfig[item.status] || statusConfig.pending;
                    const ItemIcon = itemConfig.icon;

                    return (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <ItemIcon
                          className={cn(
                            "h-3 w-3 shrink-0",
                            itemConfig.color,
                            item.status === "processing" && "animate-spin"
                          )}
                        />
                        <TypeIcon className={cn("h-3 w-3 shrink-0", typeInfo?.color || "text-muted-foreground")} />
                        <span className="text-muted-foreground flex-1">
                          {typeInfo?.label || item.type}
                        </span>
                        {item.status === "processing" && (
                          <span className="text-amber-400 text-[10px]">{item.progress}%</span>
                        )}
                        {item.status === "done" && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                        {item.status === "error" && (
                          <span className="text-[10px] text-red-400/80 truncate max-w-[120px]" title={item.error || undefined}>
                            {item.error || "Ошибка"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar for processing items */}
                {isProcessing && (
                  <div className="ml-6 mt-2">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500/50 rounded-full transition-all duration-500"
                        style={{ width: `${avgProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-muted-foreground/50 ml-6 mt-1.5">
                  {group.items[0]?.startedAt
                    ? `Начато: ${new Date(group.items[0].startedAt).toLocaleString("ru-RU")}`
                    : `Создано: ${new Date(group.items[0]?.createdAt || "").toLocaleString("ru-RU")}`}
                </p>

                {/* Action buttons for articles with pending or error items */}
                {(hasPending || group.overallStatus === "error") && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-6">
                    {group.items
                      .filter((i) => i.status === "pending" || i.status === "error")
                      .map((item) => {
                        const typeInfo = typeLabels[item.type];
                        if (!typeInfo) return null;
                        const TypeIcon = typeInfo.icon;
                        const aiType = aiTypes.find(
                          (t) => t.queueType === item.type
                        );
                        const isItemError = item.status === "error";

                        return (
                          <Button
                            key={item.id}
                            size="sm"
                            onClick={() =>
                              handleStartProcessing(group.articleId, aiType?.type || "metadata")
                            }
                            disabled={!!processing || processingAll}
                            className={cn(
                              "h-6 px-2 text-[10px] gap-1",
                              isItemError
                                ? "bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300"
                                : "bg-white/5 border border-white/10 hover:bg-white/10",
                              !isItemError && typeInfo.color
                            )}
                            variant="outline"
                          >
                            {isItemError ? <RefreshCw className="h-2.5 w-2.5" /> : <TypeIcon className="h-2.5 w-2.5" />}
                            {isItemError ? "Повтор" : typeInfo.label}
                          </Button>
                        );
                      })}
                    <Button
                      size="sm"
                      onClick={() => handleStartAllForArticle(group.articleId)}
                      disabled={!!processing || processingAll}
                      className="h-6 px-2 text-[10px] gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      <Zap className="h-2.5 w-2.5" />
                      Все
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline explanation */}
      {items.length > 0 && !processingAll && (
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground/80 flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            Как работает обработка:
          </p>
          <div className="flex flex-wrap items-center gap-1 ml-5">
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">1. Извлечь текст</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">2. Метаданные</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">3. Глоссарий</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">4. Граф знаний</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Опубликована</span>
          </div>
          <p className="ml-5 text-muted-foreground/60">
            После всех шагов статья автоматически появляется в Базе знаний с извлечённым контентом, глоссарием и связями.
          </p>
        </div>
      )}

      {hasActiveItems && (
        <p className="text-[10px] text-muted-foreground/40 text-center">
          Автообновление каждые 5 секунд
        </p>
      )}
    </div>
  );
}
