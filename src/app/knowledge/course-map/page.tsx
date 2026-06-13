"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Lock,
  Play,
  Trophy,
  MapPin,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface SpaceProgress {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  totalArticles: number;
  completedArticles: number;
}

interface ArticleItem {
  id: string;
  title: string;
  difficulty: string | null;
  estimatedTime: string | null;
  completed: boolean;
  complexityOrder: number | null;
  status?: string;
}

interface SpaceWithArticles extends SpaceProgress {
  articles: ArticleItem[];
}

interface CourseMapData {
  spaces: SpaceWithArticles[];
  totalArticles: number;
  totalCompleted: number;
  percentage: number;
  hasStarted: boolean;
  isComplete: boolean;
  nextLesson: { id: string; title: string; slug: string; spaceSlug: string; spaceName: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────

function isEmojiIcon(str: string): boolean {
  if (!str) return false;
  const graphemes = [...str];
  return graphemes.length <= 2 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}

function getAbbrev(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function getDifficultyColor(difficulty: string | null): string {
  switch (difficulty) {
    case "easy": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "hard": return "text-red-400 bg-red-500/10 border-red-500/20";
    default: return "text-muted-foreground bg-white/5 border-white/10";
  }
}

function getDifficultyLabel(difficulty: string | null): string {
  switch (difficulty) {
    case "easy": return "Легко";
    case "medium": return "Средне";
    case "hard": return "Сложно";
    default: return "—";
  }
}

// ── Component ──────────────────────────────────────────────────

export default function CourseMapPage() {
  const [courseMap, setCourseMap] = useState<CourseMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);

  useEffect(() => {
    // Fetch course progress with articles
    fetch("/api/knowledge/course-progress")
      .then((r) => r.json())
      .then((progressData) => {
        if (!progressData.spaces) {
          setCourseMap(null);
          setLoading(false);
          return;
        }

        // Map articles from articlesBySpace
        const articlesBySpace = progressData.articlesBySpace || {};
        const spacesWithArticles: SpaceWithArticles[] = progressData.spaces.map(
          (space: SpaceProgress) => ({
            ...space,
            articles: (articlesBySpace[space.id] || []).map(
              (a: { id: string; title: string; difficulty: string | null; estimatedTime: string | null; complexityOrder: number | null; completed: boolean; status?: string }) => ({
                id: a.id,
                title: a.title,
                difficulty: a.difficulty,
                estimatedTime: a.estimatedTime,
                complexityOrder: a.complexityOrder,
                completed: a.completed,
                status: a.status,
              })
            ),
          })
        );

        setCourseMap({
          ...progressData,
          spaces: spacesWithArticles,
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Determine space states
  const getSpaceState = (space: SpaceProgress, index: number) => {
    if (!courseMap) return "locked";
    const isComplete = space.completedArticles >= space.totalArticles && space.totalArticles > 0;
    if (isComplete) return "complete";

    const isStarted = space.completedArticles > 0;
    if (isStarted) return "current";

    // First space or previous space is complete → unlocked
    if (index === 0) return "available";
    const prevSpace = courseMap.spaces[index - 1];
    if (prevSpace && prevSpace.completedArticles >= prevSpace.totalArticles && prevSpace.totalArticles > 0) {
      return "available";
    }

    return "locked";
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Page Header — compact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
            <MapPin className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Карта курса</h1>
            <p className="text-muted-foreground text-xs">
              Разделы по порядку — от основ к продвинутым
            </p>
          </div>
        </motion.div>

        {/* Total Progress — compact inline bar */}
        {courseMap && courseMap.totalArticles > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.03 }}
            className="glass rounded-xl border border-white/5 px-4 py-2.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                {courseMap.isComplete ? (
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                ) : courseMap.hasStarted ? (
                  <Target className="h-3.5 w-3.5 text-violet-400" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className="text-xs font-medium">
                  {courseMap.isComplete ? "Пройден!" : courseMap.hasStarted ? "Прогресс" : "Начать?"}
                </span>
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    courseMap.isComplete
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                      : "bg-gradient-to-r from-violet-500 to-cyan-400"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${courseMap.percentage}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {courseMap.totalCompleted}/{courseMap.totalArticles} · {courseMap.percentage}%
              </span>
              {courseMap.nextLesson && !courseMap.isComplete && (
                <Link
                  href={`/knowledge/${encodeURIComponent(courseMap.nextLesson.spaceSlug)}/learn/${courseMap.nextLesson.id}`}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors shrink-0"
                >
                  <Play className="h-2.5 w-2.5" />
                  {courseMap.nextLesson.title}
                </Link>
              )}
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Course Map — compact rows, all on one screen */}
        {!loading && courseMap && courseMap.spaces.length > 0 && (
          <div className="space-y-1">
            {courseMap.spaces.map((space, idx) => {
              const state = getSpaceState(space, idx);
              const isLocked = state === "locked";
              const isComplete = state === "complete";
              const isCurrent = state === "current";
              const isAvailable = state === "available";
              const isExpanded = expandedSpace === space.id;

              // Progress dots: ● for completed, ○ for available, ◌ for locked
              const progressDots = Array.from({ length: Math.min(space.totalArticles, 10) }, (_, i) => {
                if (i < space.completedArticles) return "completed";
                if (isLocked) return "locked";
                return "pending";
              });

              return (
                <motion.div
                  key={space.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: isLocked ? 0.35 : 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer group",
                      isLocked
                        ? "bg-white/[0.01] hover:bg-white/[0.02]"
                        : isComplete
                        ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                        : isCurrent
                        ? "bg-violet-500/[0.04] hover:bg-violet-500/[0.08]"
                        : "bg-white/[0.02] hover:bg-white/[0.04]"
                    )}
                    onClick={() => !isLocked && setExpandedSpace(isExpanded ? null : space.id)}
                  >
                    {/* Space icon — small */}
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-sm",
                        isComplete
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isCurrent
                          ? "bg-violet-500/20 text-violet-400"
                          : isAvailable
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-white/5 text-muted-foreground/40"
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : isEmojiIcon(space.icon || "") ? (
                        <span>{space.icon}</span>
                      ) : (
                        <span className="text-[10px] font-bold">{getAbbrev(space.name)}</span>
                      )}
                    </div>

                    {/* Space info — inline */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          isLocked
                            ? "text-muted-foreground/50"
                            : isComplete
                            ? "text-emerald-400"
                            : isCurrent
                            ? "text-violet-400"
                            : "text-foreground"
                        )}
                      >
                        {space.name}
                      </span>

                      {/* Progress dots — inline */}
                      <div className="flex items-center gap-[3px] shrink-0">
                        {progressDots.map((dot, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dot === "completed"
                                ? "bg-emerald-400"
                                : dot === "locked"
                                ? "bg-white/10"
                                : "bg-white/20"
                            )}
                          />
                        ))}
                        {space.totalArticles > 10 && (
                          <span className="text-[8px] text-muted-foreground ml-0.5">
                            +{space.totalArticles - 10}
                          </span>
                        )}
                      </div>

                      {/* Count */}
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {space.completedArticles}/{space.totalArticles}
                      </span>

                      {/* Status badge — minimal */}
                      {isLocked && (
                        <Lock className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[7px] px-1 py-0 border-violet-500/30 text-violet-400 bg-violet-500/10 shrink-0">
                          Текущий
                        </Badge>
                      )}
                      {isComplete && (
                        <Badge variant="outline" className="text-[7px] px-1 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shrink-0">
                          Пройден
                        </Badge>
                      )}
                    </div>

                    {/* CTA — compact */}
                    {!isLocked && (
                      <div className="shrink-0">
                        {isCurrent && courseMap.nextLesson && space.id === courseMap.spaces.find(
                          (s) => s.completedArticles < s.totalArticles && s.totalArticles > 0
                        )?.id ? (
                          <Link
                            href={`/knowledge/${encodeURIComponent(space.slug)}/learn/${courseMap.nextLesson.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              className="h-6 gap-1 bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 text-[10px] px-2"
                            >
                              <Play className="h-2.5 w-2.5" />
                              Продолжить
                            </Button>
                          </Link>
                        ) : isAvailable && space.totalArticles > 0 ? (
                          <Link
                            href={`/knowledge/${encodeURIComponent(space.slug)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              className="h-6 gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] px-2"
                            >
                              <Play className="h-2.5 w-2.5" />
                              Начать
                            </Button>
                          </Link>
                        ) : (
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 transition-transform",
                              isExpanded ? "rotate-90 text-foreground" : "text-muted-foreground/30"
                            )}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded: Articles list — compact */}
                  {isExpanded && !isLocked && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="ml-11 mt-1 space-y-0.5"
                    >
                      {space.articles.length > 0 ? (
                        space.articles.map((article, artIdx) => (
                          <Link
                            key={article.id}
                            href={`/knowledge/${encodeURIComponent(space.slug)}/learn/${article.id}`}
                            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors group"
                          >
                            <div
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold shrink-0",
                                article.completed
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : article.status === "pending"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-white/5 text-muted-foreground/50"
                              )}
                            >
                              {article.completed ? (
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              ) : article.status === "pending" ? (
                                <span className="text-[7px]">⏳</span>
                              ) : (
                                artIdx + 1
                              )}
                            </div>
                            <span
                              className={cn(
                                "flex-1 text-[11px] truncate",
                                article.completed
                                  ? "text-muted-foreground line-through"
                                  : article.status === "pending"
                                  ? "text-amber-400/70"
                                  : "text-foreground group-hover:text-emerald-400"
                              )}
                            >
                              {article.title}
                            </span>
                            {article.status === "pending" && (
                              <Badge variant="outline" className="text-[7px] px-1 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
                                AI обрабатывает
                              </Badge>
                            )}
                            {article.difficulty && (
                              <Badge
                                variant="outline"
                                className={cn("text-[7px] px-1 py-0 shrink-0", getDifficultyColor(article.difficulty))}
                              >
                                {getDifficultyLabel(article.difficulty)}
                              </Badge>
                            )}
                          </Link>
                        ))
                      ) : (
                        <div className="px-2 py-2 text-[10px] text-muted-foreground/50">
                          Нет статей в этом разделе
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Arrow between sections — minimal */}
                  {idx < courseMap.spaces.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <div className="h-2 w-px bg-white/10" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && (!courseMap || courseMap.spaces.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Разделы пока не добавлены
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Скоро здесь появится карта курса с темами и уроками
            </p>
          </motion.div>
        )}

        {/* Quick tip — minimal */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 px-1">
          <span>💡</span>
          <span>Разделы открываются последовательно. Кнопка «Начать курс» на главной ведёт сюда.</span>
        </div>
      </div>
    </AppLayout>
  );
}
