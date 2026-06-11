"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Timer,
} from "lucide-react";
import { xpForQuiz, QUIZ_TIME_PER_QUESTION } from "@/lib/gamification";
import { useUserStore } from "@/store/user-store";

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
  correctIndex: number;
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
  params: Promise<{ spaceId: string; articleId: string }>;
}) {
  const [spaceId, setSpaceId] = useState<string>("");
  const [articleId, setArticleId] = useState<string>("");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [pathArticles, setPathArticles] = useState<PathArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Lesson flow state
  const [activeBlock, setActiveBlock] = useState<LessonBlock>("summary");
  const [completedBlocks, setCompletedBlocks] = useState<Set<LessonBlock>>(new Set());
  const [lessonCompleted, setLessonCompleted] = useState(false);

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
      setSpaceId(decodeURIComponent(p.spaceId));
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

  // Get the label for the next block's navigation button
  const getNextBlockLabel = useCallback((currentBlock: LessonBlock, blocks: LessonBlock[]): string => {
    const currentIdx = blocks.indexOf(currentBlock);
    if (currentIdx >= 0 && currentIdx < blocks.length - 1) {
      const nextBlock = blocks[currentIdx + 1];
      const blockInfo = BLOCK_CONFIG.find((b) => b.id === nextBlock);
      if (nextBlock === "quiz") return "Перейти к проверке знаний";
      if (nextBlock === "practice") return "Перейти к практике";
      if (nextBlock === "article") return "Перейти к конспекту";
      if (nextBlock === "materials") return "Перейти к материалам";
      return blockInfo ? `Перейти: ${blockInfo.label}` : "Далее";
    }
    return "Завершить урок";
  }, []);

  // Progress calculation
  const progressPercent = availableBlocks.length > 0
    ? Math.round((completedBlocks.size / availableBlocks.length) * 100)
    : 0;

  // Mark block as completed and auto-advance to next block
  const completeBlock = useCallback((block: LessonBlock) => {
    setCompletedBlocks((prev) => {
      const next = new Set(prev);
      next.add(block);
      // Check if all blocks are now completed
      if (next.size >= availableBlocks.length) {
        setLessonCompleted(true);
      }
      return next;
    });
    // Auto-advance to the next available block
    const currentIdx = availableBlocks.indexOf(block);
    if (currentIdx >= 0 && currentIdx < availableBlocks.length - 1) {
      setActiveBlock(availableBlocks[currentIdx + 1]);
    }
  }, [availableBlocks]);

  const goToNextBlock = useCallback(() => {
    const currentIdx = availableBlocks.indexOf(activeBlock);
    if (currentIdx < availableBlocks.length - 1) {
      const nextBlock = availableBlocks[currentIdx + 1];
      completeBlock(activeBlock);
      setActiveBlock(nextBlock);
    } else {
      completeBlock(activeBlock);
    }
  }, [activeBlock, availableBlocks, completeBlock]);

  // Navigation between lessons in the path
  const currentPathIndex = pathArticles.findIndex((a) => a.id === articleId);
  const prevLesson = currentPathIndex > 0 ? pathArticles[currentPathIndex - 1] : null;
  const nextLesson =
    currentPathIndex >= 0 && currentPathIndex < pathArticles.length - 1
      ? pathArticles[currentPathIndex + 1]
      : null;

  // Parse quiz from JSON if needed
  const quiz: QuizQuestion[] = useMemo(() => {
    if (!article?.quiz) return [];
    if (Array.isArray(article.quiz)) return article.quiz;
    try {
      return JSON.parse(article.quiz as unknown as string);
    } catch {
      return [];
    }
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
              <BreadcrumbLink asChild>
                <Link href="/knowledge">База знаний</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {space ? (
                <BreadcrumbLink asChild>
                  <Link href={`/knowledge/${encodeURIComponent(space.slug)}`}>
                    {space.name}
                  </Link>
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
          className="glass rounded-xl p-5 border-white/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <h1 className="text-xl font-bold md:text-2xl">{article.title}</h1>
              {article.summary && (
                <p className="text-sm text-muted-foreground">{article.summary}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
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

          {/* Progress */}
          <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Прогресс урока</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
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
                onClick={() => setActiveBlock(block.id)}
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

        {/* Active Block Content */}
        <AnimatePresence mode="wait">
          {lessonCompleted ? (
            <motion.div
              key="lesson-complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="glass border-white/5 text-center">
                <CardContent className="py-10 space-y-4">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="text-xl font-semibold text-foreground">Урок завершён!</h3>
                  <p className="text-sm text-muted-foreground">
                    Вы прошли все разделы урока «{article.title}»
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    {nextLesson ? (
                      <Link href={`/knowledge/${encodeURIComponent(spaceId)}/learn/${nextLesson.id}`}>
                        <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
                          Следующий урок: {nextLesson.title}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/knowledge/materials">
                        <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
                          Вернуться к материалам
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    <Link href={`/knowledge/article/${article.id}`}>
                      <Button variant="outline" size="sm">
                        Перечитать статью
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
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
                timecodes={timecodes}
                nextBlockLabel={getNextBlockLabel("summary", availableBlocks)}
                onComplete={() => completeBlock("summary")}
              />
            )}
            {activeBlock === "materials" && (
              <MaterialsBlock
                article={article}
                timecodes={timecodes}
                nextBlockLabel={getNextBlockLabel("materials", availableBlocks)}
                onComplete={() => completeBlock("materials")}
              />
            )}
            {activeBlock === "article" && (
              <ArticleBlock
                article={article}
                nextBlockLabel={getNextBlockLabel("article", availableBlocks)}
                onComplete={() => completeBlock("article")}
              />
            )}
            {activeBlock === "quiz" && (
              <QuizBlock
                quiz={quiz}
                articleId={articleId}
                difficulty={article.difficulty}
                answers={quizAnswers}
                setAnswers={setQuizAnswers}
                checked={quizChecked}
                setChecked={setQuizChecked}
                onComplete={() => completeBlock("quiz")}
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
                onComplete={() => completeBlock("practice")}
              />
            )}
          </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Footer — hidden when lesson is completed */}
        {!lessonCompleted && (
        <div className="flex items-center justify-between pt-4">
          {prevLesson ? (
            <Link href={`/knowledge/${encodeURIComponent(spaceId)}/learn/${prevLesson.id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                {prevLesson.title}
              </Button>
            </Link>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {activeBlock !== availableBlocks[availableBlocks.length - 1] ? (
              <Button
                onClick={goToNextBlock}
                size="sm"
                className="gap-1 bg-emerald-600 hover:bg-emerald-500"
              >
                Далее
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-sm text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Урок пройден!
              </span>
            )}
          </div>

          {nextLesson ? (
            <Link href={`/knowledge/${encodeURIComponent(spaceId)}/learn/${nextLesson.id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                {nextLesson.title}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div />
          )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Block 1: Summary
// ═══════════════════════════════════════════════════════════════════

function SummaryBlock({
  article,
  keyConcepts,
  timecodes,
  nextBlockLabel,
  onComplete,
}: {
  article: ArticleData;
  keyConcepts: string[];
  timecodes: TimecodeEntry[];
  nextBlockLabel: string;
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
      <CardContent className="space-y-4">
        {/* Summary */}
        {article.summary && (
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-sm leading-relaxed">{article.summary}</p>
          </div>
        )}

        {/* Key Concepts */}
        {keyConcepts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              Ключевые концепции
            </h4>
            <div className="flex flex-wrap gap-2">
              {keyConcepts.map((concept) => (
                <Badge
                  key={concept}
                  variant="outline"
                  className="border-emerald-500/20 text-emerald-400"
                >
                  {concept}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Lesson Structure (timecodes preview) */}
        {timecodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <List className="h-4 w-4 text-blue-400" />
              Структура урока
            </h4>
            <div className="space-y-1">
              {timecodes.map((tc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm py-1"
                >
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5 w-14">
                    {tc.time}
                  </span>
                  <div>
                    <span className="font-medium">{tc.title}</span>
                    {tc.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tc.summary}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What you'll learn */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
          </div>
        </div>

        <Button
          onClick={onComplete}
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-500 mt-2"
        >
          {nextBlockLabel}
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
  timecodes,
  nextBlockLabel,
  onComplete,
}: {
  article: ArticleData;
  timecodes: TimecodeEntry[];
  nextBlockLabel: string;
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
      <CardContent className="space-y-4">
        {/* Video Player */}
        {article.videoUrl && (
          <div className="rounded-lg overflow-hidden border border-white/5">
            <VideoEmbed url={article.videoUrl} />
          </div>
        )}

        {/* Timecodes Navigation */}
        {timecodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <List className="h-4 w-4 text-blue-400" />
              Таймкоды
            </h4>
            <div className="glass rounded-lg p-3 space-y-1 max-h-[300px] overflow-y-auto">
              {timecodes.map((tc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm py-1.5 px-2 rounded hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-mono text-emerald-400 shrink-0 mt-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {tc.time}
                  </span>
                  <div>
                    <span className="font-medium">{tc.title}</span>
                    {tc.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tc.summary}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source Link */}
        {article.sourceUrl && (
          <div className="pt-2">
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
          {nextBlockLabel}
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
  nextBlockLabel,
  onComplete,
}: {
  article: ArticleData;
  nextBlockLabel: string;
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
          {nextBlockLabel}
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
  articleId,
  difficulty,
  answers,
  setAnswers,
  checked,
  setChecked,
  onComplete,
}: {
  quiz: QuizQuestion[];
  articleId: string;
  difficulty: string | null;
  answers: Map<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete: () => void;
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_PER_QUESTION);
  const [xpEarned, setXpEarned] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (checked) return;
    if (timeLeft <= 0) {
      // Time's up for this question — auto-advance
      if (currentQuestion < quiz.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
        setTimeLeft(QUIZ_TIME_PER_QUESTION);
      } else {
        // Last question — auto check
        setChecked(true);
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, checked, currentQuestion, quiz.length, setChecked]);

  // Calculate XP and submit when quiz is checked
  const handleCheckAnswers = useCallback(() => {
    setChecked(true);
    const correctCount = quiz.filter((q, i) => answers.get(i) === q.correctIndex).length;
    const earnedXp = xpForQuiz(correctCount, quiz.length, difficulty || "medium");
    setXpEarned(earnedXp);

    // Submit quiz results for XP
    (async () => {
      try {
        setIsSubmitting(true);
        const res = await fetch("/api/knowledge/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId,
            correctCount,
            totalCount: quiz.length,
            difficulty: difficulty || "medium",
            timeSpent: quiz.length * QUIZ_TIME_PER_QUESTION - timeLeft,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // Update user store with new XP and level
          const store = useUserStore.getState();
          store.addXp(data.xpEarned);
          store.setLevel(data.newLevel);
        }
      } catch (err) {
        console.error("Failed to submit quiz results:", err);
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [quiz, answers, difficulty, articleId, timeLeft, setChecked]);

  // Navigate to next question
  const handleNextQuestion = useCallback(() => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setTimeLeft(QUIZ_TIME_PER_QUESTION);
    }
  }, [currentQuestion, quiz.length]);

  // Select answer for current question
  const handleSelectAnswer = useCallback((oIdx: number) => {
    if (checked) return;
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentQuestion, oIdx);
      return next;
    });
  }, [checked, currentQuestion, setAnswers]);

  const correctCount = quiz.filter((q, i) => answers.get(i) === q.correctIndex).length;
  const isLastQuestion = currentQuestion === quiz.length - 1;

  // Timer color based on time remaining
  const timerColor =
    timeLeft > 20 ? "text-emerald-400" : timeLeft > 10 ? "text-amber-400" : "text-red-400";
  const timerBarColor =
    timeLeft > 20
      ? "[&>div]:bg-emerald-500"
      : timeLeft > 10
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-red-500";

  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HelpCircle className="h-5 w-5 text-purple-400" />
          Проверка знаний
          <Badge variant="outline" className="text-xs border-white/10 ml-auto">
            {currentQuestion + 1} / {quiz.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer bar */}
        {!checked && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-1 font-medium ${timerColor}`}>
                <Timer className="h-3.5 w-3.5" />
                {timeLeft}с
              </span>
              <span className="text-muted-foreground">
                Вопрос {currentQuestion + 1} из {quiz.length}
              </span>
            </div>
            <Progress
              value={(timeLeft / QUIZ_TIME_PER_QUESTION) * 100}
              className={`h-1.5 ${timerBarColor}`}
            />
          </div>
        )}

        {/* Current question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {(() => {
              const q = quiz[currentQuestion];
              const selectedAnswer = answers.get(currentQuestion);
              const isCorrect = selectedAnswer === q.correctIndex;
              const isWrong = checked && selectedAnswer !== undefined && !isCorrect;
              const isUnanswered = checked && selectedAnswer === undefined;

              return (
                <div
                  className={`p-4 rounded-lg border transition-colors ${
                    checked
                      ? isCorrect
                        ? "border-green-500/30 bg-green-500/5"
                        : isWrong || isUnanswered
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-white/5 bg-white/[0.02]"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <h4 className="text-sm font-medium mb-3">
                    {currentQuestion + 1}. {q.question}
                  </h4>

                  <div className="space-y-2">
                    {q.options.map((option, oIdx) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrectOption = checked && oIdx === q.correctIndex;

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectAnswer(oIdx)}
                          disabled={checked}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                            checked
                              ? isCorrectOption
                                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                                : isSelected && !isCorrectOption
                                ? "bg-red-500/10 border border-red-500/30 text-red-400"
                                : "bg-white/[0.02] border border-white/5 text-muted-foreground"
                              : isSelected
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                              : "bg-white/[0.02] border border-white/5 text-foreground hover:bg-white/5 hover:border-white/10"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0">
                            {checked && isCorrectOption ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : checked && isSelected && !isCorrectOption ? (
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

                  {/* Explanation */}
                  {checked && q.explanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Пояснение:</span>{" "}
                        {q.explanation}
                      </p>
                    </motion.div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation / Check / Results */}
        {!checked ? (
          <div className="flex gap-3">
            {!isLastQuestion ? (
              <Button
                onClick={handleNextQuestion}
                size="sm"
                className="flex-1 bg-purple-600 hover:bg-purple-500"
              >
                Следующий вопрос
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCheckAnswers}
                size="sm"
                className="flex-1 bg-purple-600 hover:bg-purple-500"
              >
                Проверить ответы
              </Button>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div
              className={`p-4 rounded-lg text-center ${
                correctCount === quiz.length
                  ? "bg-green-500/10 border border-green-500/20"
                  : correctCount >= quiz.length / 2
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <p className="text-lg font-bold">
                {correctCount} из {quiz.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {correctCount === quiz.length
                  ? "Отлично! Все ответы верные!"
                  : correctCount >= quiz.length / 2
                  ? "Хороший результат, но есть что улучшить"
                  : "Рекомендуем перечитать материал"}
              </p>
              {/* XP earned */}
              <div className="mt-2 pt-2 border-t border-white/10">
                <span className="text-amber-400 font-bold text-base">
                  +{xpEarned} XP
                </span>
                <span className="text-muted-foreground text-sm ml-1.5">за квиз!</span>
              </div>
            </div>
            <Button
              onClick={onComplete}
              size="sm"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500"
            >
              {isSubmitting ? "Сохраняем..." : "Перейти к практике"}
              {!isSubmitting && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </motion.div>
        )}

        {/* Question dots navigation (not checked) */}
        {!checked && quiz.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {quiz.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (!checked) {
                    setCurrentQuestion(idx);
                    setTimeLeft(QUIZ_TIME_PER_QUESTION);
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentQuestion
                    ? "bg-purple-400 w-4"
                    : answers.has(idx)
                    ? "bg-emerald-400/60"
                    : "bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
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


