"use client";

import { useState, useEffect, useCallback } from "react";
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
  Cpu,
  X,
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
  ai_metadata: { label: "Метаданные", icon: Sparkles, color: "text-blue-400" },
  glossary_extract: { label: "Глоссарий", icon: BookOpen, color: "text-purple-400" },
  graph_build: { label: "Граф знаний", icon: GitBranch, color: "text-amber-400" },
};

// AI processing types with icons
const aiTypes = [
  { type: "metadata", label: "Метаданные", icon: Sparkles, color: "text-blue-400" },
  { type: "glossary", label: "Глоссарий", icon: BookOpen, color: "text-purple-400" },
  { type: "graph", label: "Граф знаний", icon: GitBranch, color: "text-amber-400" },
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

  // Group items by articleId
  const groups: ArticleGroup[] = [];
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
      groups.push(group);
    }
  }
  // Compute overall status
  for (const g of groups) {
    g.overallStatus = computeOverallStatus(g.items);
  }

  const handleStartProcessing = async (articleId: string, type: string) => {
    setProcessing(`${articleId}-${type}`);
    try {
      await fetch("/api/knowledge/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, type }),
      });
      fetchQueue();
      onQueueChange?.();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  };

  const handleStartAllForArticle = async (articleId: string) => {
    setProcessing(`${articleId}-all`);
    try {
      for (const { type } of aiTypes) {
        await fetch("/api/knowledge/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type }),
        });
      }
      fetchQueue();
      onQueueChange?.();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  };

  /** Process ALL pending articles at once */
  const handleProcessAllPending = async () => {
    const pendingArticles = groups.filter(
      (g) => g.overallStatus === "pending" || g.overallStatus === "mixed"
    );
    if (pendingArticles.length === 0) return;

    setProcessingAll(true);
    toast.info(`Начинаем обработку ${pendingArticles.length} статей...`);

    let successCount = 0;
    let errorCount = 0;

    for (const group of pendingArticles) {
      try {
        for (const { type } of aiTypes) {
          await fetch("/api/knowledge/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: group.articleId, type }),
          });
        }
        successCount++;
      } catch {
        errorCount++;
      }
    }

    fetchQueue();
    onQueueChange?.();
    setProcessingAll(false);

    if (errorCount === 0) {
      toast.success(`Обработка запущена для ${successCount} статей`);
    } else {
      toast.warning(`Обработано: ${successCount}, ошибок: ${errorCount}`);
    }
  };

  const handleCancel = async (itemId: string) => {
    try {
      await fetch(`/api/knowledge/process/${itemId}`, {
        method: "DELETE",
      });
      fetchQueue();
      onQueueChange?.();
    } catch {
      // silently fail
    }
  };

  const hasActiveItems = items.some(
    (item) => item.status === "pending" || item.status === "processing"
  );

  const pendingGroupCount = groups.filter(
    (g) => g.overallStatus === "pending" || g.overallStatus === "mixed"
  ).length;

  return (
    <div className={cn("glass rounded-xl p-5 border-white/5 space-y-4", className)}>
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
          {groups.map((group) => {
            const config = statusConfig[group.overallStatus] || statusConfig.pending;
            const Icon = config.icon;
            const hasPending = group.items.some((i) => i.status === "pending");
            const isProcessing = group.items.some((i) => i.status === "processing");
            const avgProgress = Math.round(
              group.items.reduce((sum, i) => sum + (i.progress || 0), 0) / group.items.length
            );

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
                    const TypeIcon = typeInfo?.icon || Sparkles;
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

                {/* Action buttons for articles with pending items */}
                {hasPending && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-6">
                    {group.items
                      .filter((i) => i.status === "pending")
                      .map((item) => {
                        const typeInfo = typeLabels[item.type];
                        if (!typeInfo) return null;
                        const TypeIcon = typeInfo.icon;
                        const aiType = aiTypes.find(
                          (t) =>
                            (item.type === "ai_metadata" && t.type === "metadata") ||
                            (item.type === "glossary_extract" && t.type === "glossary") ||
                            (item.type === "graph_build" && t.type === "graph")
                        );

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
                              "bg-white/5 border border-white/10 hover:bg-white/10",
                              typeInfo.color
                            )}
                            variant="outline"
                          >
                            <TypeIcon className="h-2.5 w-2.5" />
                            {typeInfo.label}
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

      {/* Guidance for pending items */}
      {pendingGroupCount > 0 && !processingAll && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>
            Нажмите <strong className="text-emerald-400">Обработать всё</strong> чтобы AI обработал все статьи, или запускайте обработку по отдельности
          </span>
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
