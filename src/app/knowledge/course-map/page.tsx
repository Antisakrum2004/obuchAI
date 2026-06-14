"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ArrowRight, CheckCircle, Lock, PlayCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CourseSpace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  articleCount: number;
}

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  difficulty: string | null;
  estimatedTime: string | null;
  isPublished: boolean;
  status: string | null; // 'pending' | 'processing' | 'done' | 'error' | null
  sourceType: string | null; // 'youtube' | 'rutube' | 'vk' | 'yandex_disk' | 'pdf' | null
  videoUrl: string | null;
}

export default function CourseMapPage() {
  const { completedChallenges, xp } = useUserStore();
  const [spaces, setSpaces] = useState<CourseSpace[]>([]);
  const [spaceArticles, setSpaceArticles] = useState<Record<string, ArticleData[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/knowledge/spaces")
      .then((r) => r.json())
      .then(async (data: CourseSpace[]) => {
        setSpaces(Array.isArray(data) ? data : []);
        // Fetch articles for each space
        const articlesMap: Record<string, ArticleData[]> = {};
        await Promise.all(
          data.map(async (space) => {
            try {
              const res = await fetch(`/api/knowledge/articles?spaceId=${space.id}&limit=50`);
              const articles = await res.json();
              articlesMap[space.id] = Array.isArray(articles) ? articles : [];
            } catch {
              articlesMap[space.id] = [];
            }
          })
        );
        setSpaceArticles(articlesMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Determine article status based on user progress + processing status
  const getArticleStatus = (article: ArticleData, index: number, total: number): "completed" | "current" | "locked" | "processing" | "error" => {
    // Show processing/error status for articles not yet published
    if (article.status === 'error') return "error";
    if (article.status === 'processing') return "processing";
    if (article.status === 'pending' && !article.isPublished) return "processing";
    // Articles with no difficulty or easy difficulty are always unlocked
    if (!article.difficulty || article.difficulty === 'easy') {
      const userLevel = Math.floor((completedChallenges || 0) / Math.max(1, total));
      if (index < userLevel) return "completed";
      return "current"; // always accessible
    }
    // User progress-based status for medium/hard articles
    const userLevel = Math.floor((completedChallenges || 0) / Math.max(1, total));
    if (index < userLevel) return "completed";
    if (index === userLevel) return "current";
    return "locked";
  };

  const getSpaceProgress = (spaceId: string): number => {
    const articles = spaceArticles[spaceId] || [];
    if (articles.length === 0) return 0;
    const completed = articles.filter((art, i) => getArticleStatus(art, i, articles.length) === "completed").length;
    return Math.round((completed / articles.length) * 100);
  };

  const getStatusColor = (status: "completed" | "current" | "locked" | "processing" | "error") => {
    switch (status) {
      case "completed": return "text-emerald-400";
      case "current": return "text-blue-400";
      case "locked": return "text-muted-foreground/40";
      case "processing": return "text-yellow-400";
      case "error": return "text-red-400";
    }
  };

  const getStatusBg = (status: "completed" | "current" | "locked" | "processing" | "error") => {
    switch (status) {
      case "completed": return "bg-emerald-500/15 border-emerald-500/30";
      case "current": return "bg-blue-500/15 border-blue-500/30";
      case "locked": return "bg-white/3 border-white/8";
      case "processing": return "bg-yellow-500/15 border-yellow-500/30";
      case "error": return "bg-red-500/15 border-red-500/30";
    }
  };

  const getStatusIcon = (status: "completed" | "current" | "locked" | "processing" | "error") => {
    switch (status) {
      case "completed": return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case "current": return <PlayCircle className="h-5 w-5 text-blue-400" />;
      case "locked": return <Lock className="h-4 w-4 text-muted-foreground/40" />;
      case "processing": return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getDifficultyBadge = (difficulty: string | null) => {
    if (!difficulty) return null;
    const colors: Record<string, string> = {
      easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      hard: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    };
    const labels: Record<string, string> = {
      easy: "Лёгкий",
      medium: "Средний",
      hard: "Сложный",
    };
    return (
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", colors[difficulty] || "bg-secondary text-muted-foreground border-white/10")}>
        {labels[difficulty] || difficulty}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                <BookOpen className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Карта курса</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Визуальный путь обучения — от основ до продвинутых тем
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-muted-foreground">Пройдено</span>
              </div>
              <div className="flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-blue-400" />
                <span className="text-muted-foreground">Текущий</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-muted-foreground">Заблокирован</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Course Map */}
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-3">
                  <Skeleton className="h-20 w-40 rounded-xl" />
                  <Skeleton className="h-20 w-40 rounded-xl" />
                  <Skeleton className="h-20 w-40 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <BookOpen className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-muted-foreground">Курс пока не добавлен</h3>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Разделы и уроки скоро появятся
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {spaces.map((space, spaceIdx) => {
              const articles = spaceArticles[space.id] || [];
              const progress = getSpaceProgress(space.id);
              const isSpaceLocked = spaceIdx > 0 && progress === 0 && articles.length > 0 && getArticleStatus(articles[0], 0, articles.length) === "locked";

              return (
                <motion.div
                  key={space.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: spaceIdx * 0.08 }}
                  className="glass rounded-2xl p-6 border border-white/5"
                >
                  {/* Space Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl text-xl",
                        isSpaceLocked ? "bg-white/5" : "bg-emerald-500/15"
                      )}>
                        {space.icon && isEmoji(space.icon) ? (
                          <span>{space.icon}</span>
                        ) : (
                          <span className="text-base font-bold text-emerald-400">{spaceIdx + 1}</span>
                        )}
                      </div>
                      <div>
                        <h2 className={cn(
                          "text-lg font-bold",
                          isSpaceLocked ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {space.name}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {articles.length} {pluralize(articles.length, "урок", "урока", "уроков")}
                          {space.description && ` · ${space.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Progress bar */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-28 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{progress}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Articles Grid */}
                  {articles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {articles.map((article, artIdx) => {
                        const status = getArticleStatus(article, artIdx, articles.length);
                        return (
                          <Tooltip key={article.id} delayDuration={200}>
                            <TooltipTrigger asChild>
                              <Link
                                href={status !== "locked" && status !== "processing" && status !== "error" ? `/knowledge/${space.slug}/learn/${article.id}` : "#"}
                                className={cn(
                                  "block rounded-xl p-4 border transition-all",
                                  getStatusBg(status),
                                  status !== "locked" && status !== "processing" && status !== "error" && "hover:scale-[1.02] cursor-pointer",
                                  status === "locked" && "opacity-50 cursor-not-allowed",
                                  (status === "processing" || status === "error") && "opacity-70 cursor-not-allowed"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 shrink-0">
                                    {getStatusIcon(status)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className={cn(
                                      "font-semibold text-sm leading-tight",
                                      getStatusColor(status)
                                    )}>
                                      {article.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                      {getDifficultyBadge(article.difficulty)}
                                      {article.estimatedTime && (
                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {article.estimatedTime}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {status !== "locked" && status !== "processing" && status !== "error" && (
                                    <ArrowRight className={cn("h-4 w-4 mt-1 shrink-0", getStatusColor(status))} />
                                  )}
                                </div>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-card border-border text-foreground">
                              <span className="font-medium">{article.title}</span>
                              {status === "completed" && <span className="ml-1.5 text-emerald-400">✓</span>}
                              {status === "current" && <span className="ml-1.5 text-blue-400 text-xs">← начни здесь</span>}
                              {status === "locked" && <span className="ml-1.5 text-muted-foreground text-xs">🔒 пройдите предыдущие</span>}
                              {status === "processing" && <span className="ml-1.5 text-yellow-400 text-xs">⏳ AI обрабатывает</span>}
                              {status === "error" && <span className="ml-1.5 text-red-400 text-xs">⚠ ошибка обработки</span>}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/50">Уроки ещё не добавлены</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function isEmoji(str: string): boolean {
  const graphemes = [...str];
  return graphemes.length <= 2 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}
