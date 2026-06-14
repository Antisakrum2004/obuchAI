"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { VideoEmbed } from "@/components/knowledge/video-embed";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  Code,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Clock,
  BarChart3,
  Sparkles,
  List,
  Trophy,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface TimecodeEntry {
  time: string;
  title: string;
  summary: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number; // normalized: supports both "correct" and "correctIndex" from API
  explanation: string;
}

interface PracticalTask {
  title: string;
  description: string;
  hint: string;
  solution: string;
  difficulty: "easy" | "medium" | "hard";
}

interface ArticleData {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  difficulty: string | null;
  estimatedTime: string | null;
  keyConcepts: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  quiz: QuizQuestion[] | null;
  practical_task: PracticalTask | null;
  timecodes: TimecodeEntry[] | null;
  prerequisites: string | null;
  nextTopics: string | null;
  tags: string | null;
  spaceId?: string;
  space?: { id: string; name: string; slug: string };
}

interface SpaceData {
  id: string;
  name: string;
  slug: string;
}

interface PathArticle {
  id: string;
  title: string;
  summary: string | null;
  difficulty: string | null;
  rank: number;
  hasQuiz: boolean;
  hasPractice: boolean;
  hasVideo: boolean;
}

type LessonBlock = "summary" | "materials" | "article" | "quiz" | "practice";

const BLOCK_CONFIG: Array<{
  id: LessonBlock;
  label: string;
  icon: React.ElementType;
}> = [
  { id: "summary", label: "Обзор", icon: BookOpen },
  { id: "materials", label: "Материалы", icon: Video },
  { id: "article", label: "Конспект", icon: FileText },
  { id: "quiz", label: "Квиз", icon: HelpCircle },
  { id: "practice", label: "Практика", icon: Code },
];

// ═══════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════

export default function LearnLessonPage({
  params,
}: {
  params: Promise<{ slug: string; articleId: string }>;
}) {
  const [spaceId, setSpaceId] = useState<string>(""); // slug value stored in spaceId variable for API compatibility
  const [articleId, setArticleId] = useState<string>("");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [pathArticles, setPathArticles] = useState<PathArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Lesson flow state
  const [activeBlock, setActiveBlock] = useState<LessonBlock>("summary");
  const [completedBlocks, setCompletedBlocks] = useState<Set<LessonBlock>>(new Set());
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Lesson completion reward state
  const [lessonXp, setLessonXp] = useState<number>(0);
  const [lessonNewLevel, setLessonNewLevel] = useState<number>(0);
  const [lessonXpToNext, setLessonXpToNext] = useState<number>(0);
  const [lessonProgressInLevel, setLessonProgressInLevel] = useState<number>(0);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Map<number, number>>(new Map());
  const [quizChecked, setQuizChecked] = useState(false);

  // Practice state
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [practiceAttempted, setPracticeAttempted] = useState(false);

  // Parse params
  useEffect(() => {
    params.then((p) => {
      setSpaceId(decodeURIComponent(p.slug));
      setArticleId(decodeURIComponent(p.articleId));
    });
  }, [params]);

  // Fetch data
  useEffect(() => {
    if (!spaceId || !articleId) return;

    async function fetchData() {
      try {
        // Fetch article (includes space info) — pass all=true so unpublished articles are visible
        const artRes = await fetch(`/api/knowledge/articles/${articleId}?all=true`);
        if (!artRes.ok) throw new Error("Статья не найдена");
        const artData = await artRes.json();
        setArticle(artData);

        // Extract space info from article response
        const spaceFromArticle = artData.space;
        if (spaceFromArticle) {
          setSpace(spaceFromArticle);
        }

        // Fetch learning path for this space
        const actualSpaceId = spaceFromArticle?.id || artData.spaceId;
        if (actualSpaceId) {
          const pathRes = await fetch(`/api/knowledge/spaces/${actualSpaceId}/path`);
          if (pathRes.ok) {
            const pathData = await pathRes.json();
            setPathArticles(pathData.path || []);
          }
        }
      } catch (err) {
        console.error("Error loading lesson:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [spaceId, articleId]);

  // Determine available blocks based on article data
  const getAvailableBlocks = useCallback((): LessonBlock[] => {
    if (!article) return ["summary"];
    const blocks: LessonBlock[] = ["summary"];
    if (article.videoUrl || article.timecodes?.length) blocks.push("materials");
    if (article.content && article.content.length > 100) blocks.push("article");
    if (article.quiz && article.quiz.length > 0) blocks.push("quiz");
    if (article.practical_task) blocks.push("practice");
    return blocks;
  }, [article]);

  const availableBlocks = getAvailableBlocks();

  // Progress calculation
  const progressPercent = availableBlocks.length > 0
    ? Math.round((completedBlocks.size / availableBlocks.length) * 100)
    : 0;

  // Mark block as completed and advance
  const completeBlock = useCallback((block: LessonBlock) => {
    setCompletedBlocks((prev) => {
      const next = new Set(prev);
      next.add(block);
      return next;
    });
  }, []);

  const goToNextBlock = useCallback(() => {
    const currentIdx = availableBlocks.indexOf(activeBlock);
    if (currentIdx < availableBlocks.length - 1) {
      const nextBlock = availableBlocks[currentIdx + 1];
      completeBlock(activeBlock);
      setActiveBlock(nextBlock);
    } else {
      completeBlock(activeBlock);
      setLessonCompleted(true);
      // Trigger completion animation & XP award
      setShowCompletionAnimation(true);
      // Call API to award XP for lesson completion
      (async () => {
        try {
          const res = await fetch('/api/knowledge/lessons/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              articleId,
              blocksCompleted: [...completedBlocks, activeBlock].length,
              totalBlocks: availableBlocks.length,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setLessonXp(data.xpEarned || 0);
            setLessonNewLevel(data.newLevel || 1);
            setLessonXpToNext(data.xpToNextLevel || 0);
            setLessonProgressInLevel(data.progressInLevel?.percentage || 0);
          }
        } catch (err) {
          console.error('Failed to award lesson XP:', err);
        }
      })();
    }
  }, [activeBlock, availableBlocks, completeBlock, articleId, completedBlocks]);

  // Navigation between lessons in the path
  const currentPathIndex = pathArticles.findIndex((a) => a.id === articleId);
  const prevLesson = currentPathIndex > 0 ? pathArticles[currentPathIndex - 1] : null;
  const nextLesson =
    currentPathIndex >= 0 && currentPathIndex < pathArticles.length - 1
      ? pathArticles[currentPathIndex + 1]
      : null;

  // Parse quiz from JSON if needed — normalize correct/correctIndex field
  const quiz: QuizQuestion[] = useMemo(() => {
    if (!article?.quiz) return [];
    let raw: unknown[];
    if (Array.isArray(article.quiz)) {
      raw = article.quiz;
    } else {
      try {
        raw = JSON.parse(article.quiz as unknown as string);
      } catch {
        return [];
      }
    }
    // Normalize: AI can return "correct" or "correctIndex" — map both to correctIndex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((q: any) => ({
      question: String(q.question || ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : typeof q.correct === "number" ? q.correct : 0,
      explanation: String(q.explanation || ""),
    }));
  }, [article?.quiz]);

  const practicalTask: PracticalTask | null = useMemo(() => {
    if (!article?.practical_task) return null;
    if (typeof article.practical_task === "object") return article.practical_task as PracticalTask;
    try {
      return JSON.parse(article.practical_task as unknown as string);
    } catch {
      return null;
    }
  }, [article?.practical_task]);

  const timecodes: TimecodeEntry[] = useMemo(() => {
    if (!article?.timecodes) return [];
    if (Array.isArray(article.timecodes)) return article.timecodes;
    try {
      return JSON.parse(article.timecodes as unknown as string);
    } catch {
      return [];
    }
  }, [article?.timecodes]);

  const keyConcepts: string[] = useMemo(() => {
    if (!article?.keyConcepts) return [];
    try {
      const parsed = typeof article.keyConcepts === "string"
        ? JSON.parse(article.keyConcepts)
        : article.keyConcepts;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [article?.keyConcepts]);

  // Scroll to top when switching blocks
  useEffect(() => {
    const container = document.querySelector('main.flex-1.overflow-y-auto');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = 0;
      });
    }
  }, [activeBlock]);

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl space-y-6 p-4">
          <div className="glass rounded-xl p-6 animate-pulse space-y-3">
            <div className="h-7 w-64 bg-white/5 rounded" />
            <div className="h-4 w-96 bg-white/5 rounded" />
          </div>
          <div className="glass rounded-xl p-6 animate-pulse space-y-4">
            <div className="h-6 w-48 bg-white/5 rounded" />
            <div className="h-4 w-full bg-white/5 rounded" />
            <div className="h-4 w-3/4 bg-white/5 rounded" />
            <div className="h-4 w-5/6 bg-white/5 rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!article) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl p-4">
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Урок не найден
            </h3>
            <Link
              href="/knowledge"
              className="text-sm text-emerald-400 hover:underline mt-2 inline-block"
            >
              Вернуться к базе знаний
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {/* [ETAP-1] Replaced Link with <a> */}
              <BreadcrumbLink asChild>
                <a href="/knowledge">База знаний</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {space ? (
                <BreadcrumbLink asChild>
                  <a href={`/knowledge/${encodeURIComponent(space.slug)}`}>
                    {space.name}
                  </a>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>...</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{article.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass rounded-xl p-2 border-white/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-lg font-bold md:text-xl">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {article.difficulty && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      article.difficulty === "easy"
                        ? "border-green-500/30 text-green-400"
                        : article.difficulty === "medium"
                        ? "border-yellow-500/30 text-yellow-400"
                        : "border-red-500/30 text-red-400"
                    }`}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {article.difficulty === "easy"
                      ? "Начальный"
                      : article.difficulty === "medium"
                      ? "Средний"
                      : "Продвинутый"}
                  </Badge>
                )}
                {article.estimatedTime && (
                  <Badge variant="outline" className="text-xs border-white/10">
                    <Clock className="h-3 w-3 mr-1" />
                    {article.estimatedTime}
                  </Badge>
                )}
                {keyConcepts.slice(0, 3).map((concept) => (
                  <Badge
                    key={concept}
                    variant="outline"
                    className="text-xs border-emerald-500/20 text-emerald-400"
                  >
                    {concept}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Block Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {BLOCK_CONFIG.map((block) => {
            const isAvailable = availableBlocks.includes(block.id);
            const isCompleted = completedBlocks.has(block.id);
            const isActive = activeBlock === block.id;
            const Icon = block.icon;

            if (!isAvailable) return null;

            return (
              <button
                key={block.id}
                onClick={() => { setActiveBlock(block.id); setLessonCompleted(false); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isCompleted
                    ? "bg-white/5 text-muted-foreground border border-white/5 hover:bg-white/10"
                    : "bg-white/[0.02] text-muted-foreground/60 border border-white/[0.03] hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {block.label}
                {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Lesson Completed — Celebration Screen */}
        {lessonCompleted && (
          <LessonCompleteScreen
            articleTitle={article.title}
            xpEarned={lessonXp}
            newLevel={lessonNewLevel}
            xpToNextLevel={lessonXpToNext}
            progressInLevel={lessonProgressInLevel}
            showAnimation={showCompletionAnimation}
            onAnimationEnd={() => setShowCompletionAnimation(false)}
            nextLesson={nextLesson}
            spaceSlug={space?.slug || ''}
            onRetry={() => {
              setLessonCompleted(false);
              setActiveBlock("summary");
              setCompletedBlocks(new Set());
              setQuizAnswers(new Map());
              setQuizChecked(false);
              setShowHint(false);
              setShowSolution(false);
              setPracticeAttempted(false);
              setLessonXp(0);
              setLessonNewLevel(0);
              setLessonXpToNext(0);
              setLessonProgressInLevel(0);
              setShowCompletionAnimation(false);
            }}
          />
        )}

        {/* Active Block Content */}
        {!lessonCompleted && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeBlock}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {activeBlock === "summary" && (
              <SummaryBlock
                article={article}
                keyConcepts={keyConcepts}
                onComplete={goToNextBlock}
              />
            )}
            {activeBlock === "materials" && (
              <MaterialsBlock
                article={article}
                onComplete={goToNextBlock}
              />
            )}
            {activeBlock === "article" && (
              <ArticleBlock
                article={article}
                onComplete={goToNextBlock}
              />
            )}
            {activeBlock === "quiz" && (
              <QuizBlock
                quiz={quiz}
                answers={quizAnswers}
                setAnswers={setQuizAnswers}
                checked={quizChecked}
                setChecked={setQuizChecked}
                onComplete={goToNextBlock}
              />
            )}
            {activeBlock === "practice" && (
              <PracticeBlock
                task={practicalTask}
                showHint={showHint}
                setShowHint={setShowHint}
                showSolution={showSolution}
                setShowSolution={setShowSolution}
                attempted={practiceAttempted}
                setAttempted={setPracticeAttempted}
                onComplete={goToNextBlock}
              />
            )}
          </motion.div>
        </AnimatePresence>
        )}

        {/* No navigation footer — removed unnecessary prev/next buttons with article titles */}
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Lesson Complete Celebration Screen
// ═══════════════════════════════════════════════════════════════════

function LessonCompleteScreen({
  articleTitle,
  xpEarned,
  newLevel,
  xpToNextLevel,
  progressInLevel,
  showAnimation,
  onAnimationEnd,
  nextLesson,
  spaceSlug,
  onRetry,
}: {
  articleTitle: string;
  xpEarned: number;
  newLevel: number;
  xpToNextLevel: number;
  progressInLevel: number;
  showAnimation: boolean;
  onAnimationEnd: () => void;
  nextLesson: PathArticle | null;
  spaceSlug: string;
  onRetry: () => void;
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpDisplay, setXpDisplay] = useState(0);

  // Trigger confetti on mount
  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Animate XP counting up
  useEffect(() => {
    if (xpEarned <= 0) return;
    const duration = 1500; // ms
    const steps = 30;
    const increment = xpEarned / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= xpEarned) {
        setXpDisplay(xpEarned);
        clearInterval(interval);
      } else {
        setXpDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [xpEarned]);

  const confettiColors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ef4444", "#ec4899", "#22d3ee"];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
      className="glass rounded-xl p-8 border border-emerald-500/20 text-center space-y-6 relative overflow-hidden"
    >
      {/* Confetti particles */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                backgroundColor: confettiColors[i % confettiColors.length],
                width: 4 + Math.random() * 8,
                height: 4 + Math.random() * 8,
                left: `${Math.random() * 100}%`,
                top: "-5%",
              }}
              initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              animate={{
                y: window?.innerHeight ? window.innerHeight + 100 : 800,
                x: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
                opacity: [1, 1, 0.5, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 1,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Trophy icon with glow */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.2, stiffness: 150, damping: 12 }}
        className="relative mx-auto"
      >
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/30 to-violet-500/30 flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(16,185,129,0.3)] border-2 border-emerald-500/30">
          <Trophy className="h-12 w-12 text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
        </div>
        {/* Sparkles around trophy */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          {[0, 90, 180, 270].map((angle) => (
            <Sparkles
              key={angle}
              className="absolute h-4 w-4 text-yellow-400/60"
              style={{
                top: `${50 - 60 * Math.cos((angle * Math.PI) / 180)}%`,
                left: `${50 + 60 * Math.sin((angle * Math.PI) / 180)}%`,
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">
          Урок завершён!
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          Вы прошли все разделы урока «{articleTitle}»
        </p>
      </motion.div>

      {/* XP earned card */}
      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          className="mx-auto max-w-xs"
        >
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-violet-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <span className="text-3xl font-black text-emerald-400">
                +{xpDisplay} XP
              </span>
            </div>

            {/* Progress to next level */}
            {newLevel > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Уровень {newLevel}</span>
                  <span>До следующего: {xpToNextLevel} XP</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressInLevel}%` }}
                    transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex flex-wrap gap-2 justify-center pt-2"
      >
        {nextLesson && (
          <a
            href={`/knowledge/${encodeURIComponent(spaceSlug)}/learn/${nextLesson.id}`}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
          >
            Дальше
            <ArrowRight className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
        >
          Пройти заново
        </button>
        <a
          href={spaceSlug ? `/knowledge/${encodeURIComponent(spaceSlug)}` : '/knowledge'}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          К курсу
        </a>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 1: Summary
// ═══════════════════════════════════════════════════════════════════

function SummaryBlock({
  article,
  keyConcepts,
  onComplete,
}: {
  article: ArticleData;
  keyConcepts: string[];
  onComplete: () => void;
}) {
  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-emerald-400" />
          Обзор урока
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary — тезисное описание урока */}
        {article.summary && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-sm leading-relaxed">{article.summary}</p>
          </div>
        )}

        {/* Key Concepts */}
        {keyConcepts.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              Ключевые концепции
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {keyConcepts.map((concept) => (
                <Badge
                  key={concept}
                  variant="outline"
                  className="border-emerald-500/20 text-emerald-400 text-xs"
                >
                  {concept}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* What you'll learn — тезисно что будет в уроке */}
        <div className="flex flex-wrap items-center gap-1.5">
          {article.videoUrl && (
            <Badge variant="outline" className="border-blue-500/20 text-blue-400 text-xs">
              <Video className="h-3 w-3 mr-1" /> Видео
            </Badge>
          )}
          {article.quiz && (
            <Badge variant="outline" className="border-purple-500/20 text-purple-400 text-xs">
              <HelpCircle className="h-3 w-3 mr-1" /> Квиз
            </Badge>
          )}
          {article.practical_task && (
            <Badge variant="outline" className="border-orange-500/20 text-orange-400 text-xs">
              <Code className="h-3 w-3 mr-1" /> Практика
            </Badge>
          )}
          <Badge variant="outline" className="border-white/10 text-muted-foreground text-xs">
            <FileText className="h-3 w-3 mr-1" /> Конспект
          </Badge>
        </div>

        <Button
          onClick={onComplete}
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-500 mt-1"
        >
          Начать изучение
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 2: Materials (Video + Timecodes)
// ═══════════════════════════════════════════════════════════════════

function MaterialsBlock({
  article,
  onComplete,
}: {
  article: ArticleData;
  onComplete: () => void;
}) {
  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Video className="h-5 w-5 text-blue-400" />
          Видеоматериалы
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Video Player */}
        {article.videoUrl && (
          <div className="rounded-lg overflow-hidden border border-white/5">
            <VideoEmbed url={article.videoUrl} />
          </div>
        )}

        {/* Source Link */}
        {article.sourceUrl && (
          <div className="pt-1">
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-400 hover:underline flex items-center gap-1"
            >
              Открыть исходный материал
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        )}

        <Button
          onClick={onComplete}
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-500"
        >
          Продолжить к конспекту
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 3: Article (Markdown Content)
// ═══════════════════════════════════════════════════════════════════

function ArticleBlock({
  article,
  onComplete,
}: {
  article: ArticleData;
  onComplete: () => void;
}) {
  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-amber-400" />
          Конспект урока
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-emerald-400 prose-a:text-emerald-400">
          <MarkdownContent content={article.content} />
        </div>

        <Separator className="bg-white/5" />

        <Button
          onClick={onComplete}
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-500"
        >
          Перейти к проверке знаний
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 4: Quiz
// ═══════════════════════════════════════════════════════════════════

function QuizBlock({
  quiz,
  answers,
  setAnswers,
  checked,
  setChecked,
  onComplete,
}: {
  quiz: QuizQuestion[];
  answers: Map<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete: () => void;
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timedOut, setTimedOut] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const QUESTION_TIME = 30; // seconds per question

  // Current question data
  const q = quiz[currentQuestion];
  const selectedAnswer = answers.get(currentQuestion);
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = isAnswered && selectedAnswer === q.correctIndex;

  // Timer: countdown 30 seconds per question
  // Use CSS transition for smooth progress bar + setInterval for text countdown
  useEffect(() => {
    if (checked || isAnswered || timedOut) return;

    setTimeLeft(QUESTION_TIME);
    // Activate CSS transition for smooth progress bar
    // Short delay to let React render the initial 100% width first
    requestAnimationFrame(() => {
      setTimerActive(true);
    });

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — auto-mark as timed out (wrong answer)
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerActive(false);
          setTimedOut(true);
          // Record as unanswered (use -1 as sentinel)
          setAnswers((prev) => {
            const next = new Map(prev);
            next.set(currentQuestion, -1);
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerActive(false);
    };
  }, [currentQuestion, checked, isAnswered, timedOut, setAnswers]);

  // Reset timer when moving to next question
  useEffect(() => {
    setTimeLeft(QUESTION_TIME);
    setTimerActive(false);
    setTimedOut(false);
    setShowExplanation(false);
  }, [currentQuestion]);

  // Calculate final results
  const correctCount = quiz.filter(
    (qItem, i) => answers.get(i) === qItem.correctIndex
  ).length;
  const timedOutCount = quiz.filter((_, i) => answers.get(i) === -1).length;

  // Handle answer selection
  const handleAnswer = (oIdx: number) => {
    if (isAnswered || timedOut) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentQuestion, oIdx);
      return next;
    });
    setShowExplanation(true);
  };

  // Move to next question or finish
  const handleNext = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setChecked(true);
    }
  };

  // Timer color based on time remaining
  const timerColor = timeLeft > 15 ? "text-emerald-400" : timeLeft > 5 ? "text-yellow-400" : "text-red-400";
  const timerBg = timeLeft > 15 ? "bg-emerald-500/10 border-emerald-500/20" : timeLeft > 5 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";

  // Results screen
  if (checked) {
    return (
      <Card className="glass border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-violet-300" />
            Результаты квиза
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-6 rounded-lg text-center ${
              correctCount === quiz.length
                ? "bg-green-500/10 border border-green-500/20"
                : correctCount >= quiz.length / 2
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            <p className="text-3xl font-bold">
              {correctCount} из {quiz.length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {correctCount === quiz.length
                ? "Отлично! Все ответы верные!"
                : correctCount >= quiz.length / 2
                ? "Хороший результат, но есть что улучшить"
                : "Рекомендуем перечитать материал"}
            </p>
            {timedOutCount > 0 && (
              <p className="text-xs text-yellow-400/70 mt-2">
                {timedOutCount} {timedOutCount === 1 ? "вопрос" : "вопроса"} пропущено по таймеру
              </p>
            )}
          </motion.div>

          {/* Review all answers */}
          <div className="space-y-3">
            {quiz.map((qItem, qIdx) => {
              const ans = answers.get(qIdx);
              const wasTimedOut = ans === -1;
              const wasCorrect = ans === qItem.correctIndex;
              return (
                <div
                  key={qIdx}
                  className={`p-3 rounded-lg border text-sm ${
                    wasTimedOut
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : wasCorrect
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <p className="font-medium mb-1">{qIdx + 1}. {qItem.question}</p>
                  {wasTimedOut ? (
                    <p className="text-yellow-400 text-xs">Время вышло</p>
                  ) : (
                    <p className={wasCorrect ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                      Ваш ответ: {String.fromCharCode(65 + (ans ?? 0))} — {wasCorrect ? "верно" : "неверно"}
                    </p>
                  )}
                  {qItem.explanation && (
                    <p className="text-muted-foreground text-xs mt-1">{qItem.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            onClick={onComplete}
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-500"
          >
            Перейти к практике
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active quiz — one question at a time with timer
  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HelpCircle className="h-5 w-5 text-violet-300" />
          Проверка знаний
          <Badge variant="outline" className="text-xs border-white/10 ml-auto">
            {currentQuestion + 1}/{quiz.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 justify-center">
          {quiz.map((_, i) => {
            const ans = answers.get(i);
            const isCurrent = i === currentQuestion;
            const done = ans !== undefined;
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  isCurrent
                    ? "bg-violet-300/70 w-4"
                    : done && ans === quiz[i].correctIndex
                    ? "bg-green-400"
                    : done
                    ? "bg-red-400"
                    : "bg-white/20"
                }`}
              />
            );
          })}
        </div>

        {/* Timer */}
        {!isAnswered && !timedOut && (
          <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border ${timerBg}`}>
            <Clock className={`h-4 w-4 ${timerColor}`} />
            <span className={`text-sm font-mono font-bold ${timerColor}`}>
              0:{timeLeft.toString().padStart(2, "0")}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden ml-2">
              <div
                className={`h-full rounded-full ${
                  timeLeft > 15 ? "bg-emerald-400" : timeLeft > 5 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{
                  width: timerActive ? '0%' : '100%',
                  transition: timerActive ? `width ${QUESTION_TIME}s linear` : 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Timed out message */}
        {timedOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm text-center"
          >
            <Clock className="h-4 w-4 inline mr-1" />
            Время вышло! Опыт за этот вопрос не начисляется.
          </motion.div>
        )}

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <h4 className="text-sm font-medium">
              {currentQuestion + 1}. {q.question}
            </h4>

            <div className="space-y-2">
              {q.options.map((option, oIdx) => {
                const isSelected = selectedAnswer === oIdx;
                const isCorrectOption = (isAnswered || timedOut) && oIdx === q.correctIndex;
                const isWrongOption = (isAnswered || timedOut) && isSelected && !isCorrectOption;

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleAnswer(oIdx)}
                    disabled={isAnswered || timedOut}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2 ${
                      (isAnswered || timedOut)
                        ? isCorrectOption
                          ? "bg-green-500/10 border border-green-500/30 text-green-400"
                          : isWrongOption
                          ? "bg-red-500/10 border border-red-500/30 text-red-400"
                          : "bg-white/[0.02] border border-white/5 text-muted-foreground"
                        : isSelected
                        ? "bg-violet-400/10 border border-violet-400/30 text-violet-300"
                        : "bg-white/[0.02] border border-white/5 text-foreground hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0">
                      {(isAnswered || timedOut) && isCorrectOption ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (isAnswered || timedOut) && isWrongOption ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        String.fromCharCode(65 + oIdx)
                      )}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Explanation after answering */}
        {showExplanation && q.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-3 rounded-lg bg-white/[0.03] border border-white/5"
          >
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Пояснение:</span>{" "}
              {q.explanation}
            </p>
          </motion.div>
        )}

        {/* Next / Finish button */}
        {(isAnswered || timedOut) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={handleNext}
              size="sm"
              className="w-full bg-violet-400/50 hover:bg-violet-400/70 text-violet-100 border border-violet-400/30"
            >
              {currentQuestion < quiz.length - 1 ? (
                <>
                  Следующий вопрос
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                "Показать результаты"
              )}
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 5: Practical Task
// ═══════════════════════════════════════════════════════════════════

function PracticeBlock({
  task,
  showHint,
  setShowHint,
  showSolution,
  setShowSolution,
  attempted,
  setAttempted,
  onComplete,
}: {
  task: PracticalTask | null;
  showHint: boolean;
  setShowHint: React.Dispatch<React.SetStateAction<boolean>>;
  showSolution: boolean;
  setShowSolution: React.Dispatch<React.SetStateAction<boolean>>;
  attempted: boolean;
  setAttempted: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete: () => void;
}) {
  if (!task) {
    return (
      <Card className="glass border-white/5">
        <CardContent className="py-8 text-center">
          <Code className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Практическое задание пока не добавлено
          </p>
          <Button
            onClick={onComplete}
            size="sm"
            className="mt-4 bg-emerald-600 hover:bg-emerald-500"
          >
            Завершить урок
          </Button>
        </CardContent>
      </Card>
    );
  }

  const difficultyColor =
    task.difficulty === "easy"
      ? "text-green-400 border-green-500/30"
      : task.difficulty === "medium"
      ? "text-yellow-400 border-yellow-500/30"
      : "text-red-400 border-red-500/30";

  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Code className="h-5 w-5 text-orange-400" />
          Практическое задание
          <Badge variant="outline" className={`text-xs ml-auto ${difficultyColor}`}>
            {task.difficulty === "easy"
              ? "Начальный"
              : task.difficulty === "medium"
              ? "Средний"
              : "Продвинутый"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task Title */}
        <h3 className="font-medium text-base">{task.title}</h3>

        {/* Task Description */}
        <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>

        {/* Hint */}
        {task.hint && (
          <Collapsible open={showHint} onOpenChange={setShowHint}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Lightbulb className="h-4 w-4" />
                {showHint ? "Скрыть подсказку" : "Показать подсказку"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10"
              >
                <p className="text-sm text-yellow-200/80">{task.hint}</p>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Attempt Button */}
        {!attempted && !showSolution && (
          <Button
            onClick={() => setAttempted(true)}
            size="sm"
            variant="outline"
            className="w-full border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
          >
            Я попробовал выполнить задание
          </Button>
        )}

        {/* Solution */}
        {(attempted || showSolution) && task.solution && (
          <Collapsible open={showSolution} onOpenChange={setShowSolution}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
              >
                {showSolution ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Скрыть решение
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Показать решение
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
              >
                <h5 className="text-sm font-medium text-emerald-400 mb-2">
                  Решение
                </h5>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {task.solution}
                </p>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Separator className="bg-white/5" />

        <Button
          onClick={onComplete}
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-500"
        >
          Завершить урок
          <CheckCircle2 className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Markdown Renderer (lightweight, no external deps)
// ═══════════════════════════════════════════════════════════════════

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-5 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="bg-black/40 rounded-lg p-3 overflow-x-auto text-xs font-mono text-emerald-300 border border-white/5"
          >
            <code>{codeContent.trimEnd()}</code>
          </pre>
        );
        codeContent = "";
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${elements.length}`} className="text-2xl font-bold mt-6 mb-3 first:mt-0">
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="text-xl font-bold mt-5 mb-2">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="text-lg font-semibold mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
      continue;
    }

    // Unordered list items
    if (line.match(/^[\s]*[-*]\s/)) {
      inList = true;
      listItems.push(line.replace(/^[\s]*[-*]\s/, ""));
      continue;
    }

    // Ordered list items
    if (line.match(/^[\s]*\d+\.\s/)) {
      inList = true;
      listItems.push(line.replace(/^[\s]*\d+\.\s/, ""));
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={`p-${elements.length}`}
        className="my-2 leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: inlineFormat(line) }}
      />
    );
  }

  flushList();

  return <>{elements}</>;
}

function inlineFormat(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="bg-white/5 px-1 py-0.5 rounded text-xs font-mono text-emerald-400">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
}


