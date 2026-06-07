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
  Play,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingQueueProps {
  className?: string;
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

const typeLabels: Record<string, string> = {
  zip_import: "ZIP импорт",
  ai_metadata: "AI метаданные",
  glossary_extract: "Извлечение глоссария",
  graph_build: "Построение графа",
};

// AI processing types with icons
const aiTypes = [
  { type: "metadata", label: "Метаданные", icon: Sparkles, color: "text-blue-400" },
  { type: "glossary", label: "Глоссарий", icon: BookOpen, color: "text-purple-400" },
  { type: "graph", label: "Граф знаний", icon: GitBranch, color: "text-amber-400" },
] as const;

export function ProcessingQueue({ className }: ProcessingQueueProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);

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
    }, 5000);

    return () => clearInterval(interval);
  }, [items, fetchQueue]);

  const handleStartProcessing = async (articleId: string, type: string) => {
    setProcessing(type);
    try {
      await fetch("/api/knowledge/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, type }),
      });
      fetchQueue();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  };

  const handleStartAll = async (articleId: string) => {
    setProcessing("all");
    try {
      // Run all three types sequentially: metadata → glossary → graph
      for (const { type } of aiTypes) {
        await fetch("/api/knowledge/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, type }),
        });
      }
      fetchQueue();
    } catch {
      // silently fail
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (itemId: string) => {
    try {
      await fetch(`/api/knowledge/process/${itemId}`, {
        method: "DELETE",
      });
      fetchQueue();
    } catch {
      // silently fail
    }
  };

  const hasActiveItems = items.some(
    (item) => item.status === "pending" || item.status === "processing"
  );

  return (
    <div className={cn("glass rounded-xl p-5 border-white/5 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          Очередь обработки
        </h3>
        <div className="flex items-center gap-2">
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
          Очередь пуста
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((item) => {
            const config = statusConfig[item.status] || statusConfig.pending;
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <Icon
                  className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    config.color,
                    item.status === "processing" && "animate-spin"
                  )}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {item.articleTitle || item.articleId.slice(0, 12)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] px-1.5 py-0", config.badgeColor)}
                    >
                      {config.label}
                    </Badge>
                    {item.type && typeLabels[item.type] && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border-white/10 text-muted-foreground"
                      >
                        {typeLabels[item.type]}
                      </Badge>
                    )}
                  </div>

                  {/* Progress bar for processing items */}
                  {(item.status === "processing" || item.status === "pending") && (
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/50 rounded-full transition-all duration-500"
                        style={{ width: `${item.progress || 0}%` }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {item.status === "error" && item.error && (
                    <p className="text-[11px] text-red-400/80 line-clamp-1">
                      {item.error}
                    </p>
                  )}

                  {/* Timestamps */}
                  <p className="text-[10px] text-muted-foreground/50">
                    {item.startedAt
                      ? `Начато: ${new Date(item.startedAt).toLocaleString("ru-RU")}`
                      : `Создано: ${new Date(item.createdAt).toLocaleString("ru-RU")}`}
                    {item.completedAt &&
                      ` · Завершено: ${new Date(item.completedAt).toLocaleString("ru-RU")}`}
                  </p>

                  {/* Action buttons for pending items */}
                  {item.status === "pending" && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {aiTypes.map(({ type, label, icon: TypeIcon, color }) => (
                        <Button
                          key={type}
                          size="sm"
                          onClick={() => handleStartProcessing(item.articleId, type)}
                          disabled={!!processing}
                          className={cn(
                            "h-6 px-2 text-[10px] gap-1",
                            "bg-white/5 border border-white/10 hover:bg-white/10",
                            color
                          )}
                          variant="outline"
                        >
                          <TypeIcon className="h-2.5 w-2.5" />
                          {label}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        onClick={() => handleStartAll(item.articleId)}
                        disabled={!!processing}
                        className="h-6 px-2 text-[10px] gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        <Zap className="h-2.5 w-2.5" />
                        Все
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(item.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
