"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2,
  Upload,
  Cpu,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ZipUpload } from "@/components/knowledge/zip-upload";
import { ProcessingQueue } from "@/components/knowledge/processing-queue";
import { useUserStore } from "@/store/user-store";
import { useSession } from "next-auth/react";

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
  // Sprint 6 fields
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

// ── Page Component ─────────────────────────────────────────────

export default function MaterialsPage() {
  const [articles, setArticles] = useState<MaterialArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [showZipUpload, setShowZipUpload] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const { role: storeRole } = useUserStore();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const sessionRole = (session?.user as Record<string, unknown>)?.role;
  const [apiAdmin, setApiAdmin] = useState(false);
  const isAdmin = storeRole === "admin" || sessionRole === "admin" || apiAdmin;

  useEffect(() => {
    if (storeRole === "admin" || sessionRole === "admin") return;
    fetch("/api/user/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role === "admin") setApiAdmin(true);
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

  // Filter articles
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl flex items-center gap-3">
                <Archive className="h-7 w-7 text-emerald-400" />
                Библиотека материалов
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Все статьи и материалы базы знаний — видео, PDF, презентации
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
                  onClick={() => setShowZipUpload(!showZipUpload)}
                  className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Импорт ZIP
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Processing Queue */}
        {isAdmin && showQueue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ProcessingQueue />
          </motion.div>
        )}

        {/* ZIP Upload */}
        {isAdmin && showZipUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ZipUpload
              onUploadComplete={() => {
                fetchArticles();
                setShowZipUpload(false);
              }}
            />
          </motion.div>
        )}

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass rounded-xl p-4 border-white/5"
        >
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
        </motion.div>

        {/* Articles List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
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
              {filtered.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <Link
                    href={`/knowledge/article/${article.id}`}
                    className="block"
                  >
                    <div className="glass rounded-xl p-5 border-white/5 hover:border-emerald-500/20 transition-all duration-200 h-full group">
                      {/* Title */}
                      <h3 className="font-semibold text-sm group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </h3>

                      {/* Summary */}
                      {article.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {article.summary}
                        </p>
                      )}

                      {/* Badges Row */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {/* Status Badge */}
                        {article.status && article.status !== "done" && statusConfig[article.status] && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              statusConfig[article.status].color
                            )}
                          >
                            {statusConfig[article.status].label}
                          </Badge>
                        )}

                        {/* Source Type Badge */}
                        {article.sourceType && sourceTypeConfig[article.sourceType] && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              sourceTypeConfig[article.sourceType].color
                            )}
                          >
                            {sourceTypeConfig[article.sourceType].label}
                          </Badge>
                        )}

                        {/* AI Generated Badge */}
                        {article.aiGenerated && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          >
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            AI
                          </Badge>
                        )}
                      </div>

                      {/* Media Indicators */}
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

                      {/* Footer */}
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
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Stats Footer */}
        {!loading && articles.length > 0 && (
          <div className="text-center text-xs text-muted-foreground/40 pt-2">
            Всего материалов: {articles.length} · Показано: {filtered.length}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
