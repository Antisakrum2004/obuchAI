"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { MultipleChoice, shuffleOptions } from "@/components/challenges/multiple-choice";
import { OrderingChallenge } from "@/components/challenges/ordering-challenge";
import { XPAnimation } from "@/components/gamification/xp-animation";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Flame, Heart, Zap, Timer, Trophy, RotateCcw, Target, Send, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChallengeData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  content: string;
  options: string | null;
  correctAnswer: string;
  explanation: string | null;
  hints: string | null;
  validationType: string;
  validationConfig: string | null;
}

type MarathonState = "start" | "playing" | "gameover";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashSeed(a: string, b: string): number {
  let hash = 0;
  const str = a + b;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}с`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}м ${s}с`;
}

function getMarathonMultiplier(streak: number): number {
  if (streak >= 15) return 3.0;
  if (streak >= 10) return 2.0;
  if (streak >= 5) return 1.5;
  return 1.0;
}

function getMultiplierColor(multiplier: number): string {
  if (multiplier >= 3.0) return "text-red-400";
  if (multiplier >= 2.0) return "text-purple-400";
  if (multiplier >= 1.5) return "text-amber-400";
  return "text-emerald-400";
}

function getMultiplierLabel(multiplier: number): string {
  if (multiplier >= 3.0) return "×3.0";
  if (multiplier >= 2.0) return "×2.0";
  if (multiplier >= 1.5) return "×1.5";
  return "×1.0";
}

// Validate answer locally (no API call during marathon)
function validateAnswer(challenge: ChallengeData, answer: unknown): boolean {
  if (challenge.validationType === "static") {
    try {
      const correctAnswer = JSON.parse(challenge.correctAnswer);
      if (challenge.type === "multiple_choice") {
        return answer === correctAnswer;
      } else if (challenge.type === "ordering" || challenge.type === "workflow_build") {
        const userAnswer = Array.isArray(answer) ? answer : JSON.parse(typeof answer === "string" ? answer : "[]");
        return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
      }
    } catch {
      return false;
    }
  } else if (challenge.validationType === "pattern") {
    try {
      const config = challenge.validationConfig ? JSON.parse(challenge.validationConfig) : {};
      const keywords: string[] = config.keywords || [];
      if (keywords.length > 0) {
        const answerStr = String(answer).toLowerCase();
        return keywords.every((kw: string) => answerStr.includes(kw.toLowerCase()));
      }
    } catch {
      return false;
    }
  }
  return false;
}

// ─── Animation variants ──────────────────────────────────────────────────────

const contentVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const transitionConfig = {
  duration: 0.18,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MarathonPage() {
  // Marathon state
  const [state, setState] = useState<MarathonState>("start");
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState("");

  // Game stats (refs for reliable access in timeouts)
  const [lives, setLives] = useState(3);
  const correctCountRef = useRef(0);
  const longestStreakRef = useRef(0);
  const totalAttemptsRef = useRef(0);

  // Display stats (derived from refs for gameover screen)
  const [displayCorrectCount, setDisplayCorrectCount] = useState(0);
  const [displayLongestStreak, setDisplayLongestStreak] = useState(0);
  const [displayTotalAttempts, setDisplayTotalAttempts] = useState(0);

  const [currentStreak, setCurrentStreak] = useState(0);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Answer states
  const [multipleChoiceAnswer, setMultipleChoiceAnswer] = useState<string | null>(null);
  const [orderingAnswer, setOrderingAnswer] = useState<number[]>([]);
  const [workflowAnswer, setWorkflowAnswer] = useState<number[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultState, setResultState] = useState<"correct" | "wrong" | null>(null);
  const [showXpAnimation, setShowXpAnimation] = useState(false);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Game over data
  const [xpEarned, setXpEarned] = useState(0);
  const [finalMultiplier, setFinalMultiplier] = useState(1.0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);

  // Flash overlay
  const [flashColor, setFlashColor] = useState<string | null>(null);

  // Track current index and lives in refs for timeout callbacks
  const currentIndexRef = useRef(0);
  const livesRef = useRef(3);
  const challengesRef = useRef<ChallengeData[]>([]);

  // Sync refs with state
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { challengesRef.current = challenges; }, [challenges]);

  // Timer effect
  useEffect(() => {
    if (state !== "playing" || resultState) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state, resultState]);

  // Fetch user session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        const uid = (session?.user as Record<string, unknown>)?.id as string;
        if (uid) setUserId(uid);
      })
      .catch(() => {});
  }, []);

  // Finish marathon — uses refs for reliable stats
  const finishMarathon = useCallback(() => {
    const cc = correctCountRef.current;
    const ls = longestStreakRef.current;
    const ta = totalAttemptsRef.current;

    const accuracy = ta > 0 ? Math.round((cc / ta) * 100) : 0;
    const multiplier = getMarathonMultiplier(ls);

    // Calculate XP locally for immediate feedback
    const baseXpPerCorrect = 40;
    const localXpEarned = Math.round(cc * baseXpPerCorrect * multiplier);

    setFinalMultiplier(multiplier);
    setFinalAccuracy(accuracy);
    setXpEarned(localXpEarned);
    setDisplayCorrectCount(cc);
    setDisplayLongestStreak(ls);
    setDisplayTotalAttempts(ta);
    setState("gameover");

    // Submit to API in background
    fetch("/api/marathon/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correctCount: cc,
        totalAttempts: ta,
        longestStreak: ls,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.xpEarned !== undefined) {
          setXpEarned(data.xpEarned);
          setFinalMultiplier(data.multiplier);
          setFinalAccuracy(data.accuracy);
        }
      })
      .catch(() => {
        // Keep local values as fallback
      });
  }, []);

  // Start marathon
  const startMarathon = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/marathon");
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges);
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        challengesRef.current = data.challenges;
        setLives(3);
        livesRef.current = 3;
        correctCountRef.current = 0;
        longestStreakRef.current = 0;
        totalAttemptsRef.current = 0;
        setCurrentStreak(0);
        setElapsedSeconds(0);
        setMultipleChoiceAnswer(null);
        setOrderingAnswer([]);
        setWorkflowAnswer([]);
        setResultState(null);
        setIsSubmitting(false);
        setShowXpAnimation(false);
        setFlashColor(null);
        startTimeRef.current = Date.now();
        setState("playing");
      } else {
        console.error("Failed to start marathon");
      }
    } catch {
      console.error("Network error starting marathon");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Current challenge
  const challenge = challenges[currentIndex] || null;

  // Shuffle multiple choice options
  const shuffledOptions = useMemo(() => {
    if (!challenge || challenge.type !== "multiple_choice" || !challenge.options) return [];
    try {
      const options = JSON.parse(challenge.options);
      if (!Array.isArray(options)) return [];
      const seed = hashSeed(userId || "anon", challenge.id);
      return shuffleOptions(options, seed);
    } catch {
      return [];
    }
  }, [challenge, userId]);

  // Parse ordering options
  const parsedOrderingOptions = useMemo(() => {
    if (!challenge) return [];
    if ((challenge.type === "ordering" || challenge.type === "workflow_build") && challenge.options) {
      try {
        return JSON.parse(challenge.options);
      } catch {
        return [];
      }
    }
    return [];
  }, [challenge]);

  // Parse hints
  const parsedHints = useMemo(() => {
    if (!challenge?.hints) return undefined;
    try { return JSON.parse(challenge.hints); } catch { return [challenge.hints]; }
  }, [challenge]);

  // Parse content
  const parsedContent = useMemo(() => {
    if (!challenge) return null;
    try { return JSON.parse(challenge.content); } catch { return { text: challenge.content }; }
  }, [challenge]);

  // Get current answer
  const getAnswer = useCallback(() => {
    if (!challenge) return null;
    switch (challenge.type) {
      case "multiple_choice": return multipleChoiceAnswer;
      case "ordering": return orderingAnswer.length > 0 ? orderingAnswer : null;
      case "workflow_build": return workflowAnswer.length > 0 ? workflowAnswer : null;
      default: return null;
    }
  }, [challenge, multipleChoiceAnswer, orderingAnswer, workflowAnswer]);

  const hasAnswer = (() => {
    switch (challenge?.type) {
      case "multiple_choice": return multipleChoiceAnswer !== null;
      case "ordering": return orderingAnswer.length > 0;
      case "workflow_build": return workflowAnswer.length > 0;
      default: return false;
    }
  })();

  // Calculate current multiplier
  const currentMultiplier = getMarathonMultiplier(currentStreak);

  // Reset answer state for next challenge
  const resetAnswerState = useCallback(() => {
    setMultipleChoiceAnswer(null);
    setOrderingAnswer([]);
    setWorkflowAnswer([]);
    setResultState(null);
    setIsSubmitting(false);
    setShowXpAnimation(false);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const answer = getAnswer();
    if (!answer || !challenge) return;
    if (Array.isArray(answer) && answer.length === 0) return;

    setIsSubmitting(true);
    totalAttemptsRef.current += 1;

    const isCorrect = validateAnswer(challenge, answer);

    if (isCorrect) {
      setResultState("correct");
      correctCountRef.current += 1;
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      longestStreakRef.current = Math.max(longestStreakRef.current, newStreak);
      setShowXpAnimation(true);

      // Green flash
      setFlashColor("bg-emerald-500/20");
      setTimeout(() => setFlashColor(null), 300);

      // Auto-advance after short delay
      setTimeout(() => {
        resetAnswerState();
        const nextIdx = currentIndexRef.current + 1;
        if (nextIdx >= challengesRef.current.length) {
          finishMarathon();
        } else {
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
        }
      }, 1200);
    } else {
      setResultState("wrong");
      setCurrentStreak(0);
      const newLives = livesRef.current - 1;
      setLives(newLives);
      livesRef.current = newLives;

      // Red flash
      setFlashColor("bg-red-500/20");
      setTimeout(() => setFlashColor(null), 400);

      // Auto-advance after showing wrong answer
      setTimeout(() => {
        if (newLives <= 0) {
          finishMarathon();
        } else {
          resetAnswerState();
          const nextIdx = currentIndexRef.current + 1;
          if (nextIdx >= challengesRef.current.length) {
            finishMarathon();
          } else {
            currentIndexRef.current = nextIdx;
            setCurrentIndex(nextIdx);
          }
        }
      }, 1500);
    }

    setIsSubmitting(false);
  }, [challenge, getAnswer, currentStreak, resetAnswerState, finishMarathon]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl relative">
        {/* Flash overlay */}
        {flashColor && (
          <div className={cn("fixed inset-0 z-40 pointer-events-none transition-opacity duration-300", flashColor)} />
        )}

        {/* XP Animation */}
        <XPAnimation amount={0} show={showXpAnimation} onComplete={() => setShowXpAnimation(false)} />

        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════════
              START SCREEN
          ═══════════════════════════════════════════════════════════════════════ */}
          {state === "start" && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
            >
              {/* Flame Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/20 mb-6"
                style={{ boxShadow: "0 0 40px rgba(249, 115, 22, 0.3)" }}
              >
                <Flame className="h-12 w-12 text-orange-400" />
              </motion.div>

              <h1 className="text-4xl font-bold mb-3">
                <span className="gradient-text">Марафон</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-md">
                Решайте задачи без перерыва. Чем длиннее серия правильных ответов — тем больше множитель XP!
              </p>

              {/* Rules Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 w-full max-w-lg">
                <div className="glass rounded-xl p-4 text-center">
                  <Heart className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">3 жизни</p>
                  <p className="text-xs text-muted-foreground mt-1">Ошибаться можно не более 3 раз</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <Zap className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">Без кулдаунов</p>
                  <p className="text-xs text-muted-foreground mt-1">Ошиблись — идём дальше</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <Flame className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">Множитель серии</p>
                  <p className="text-xs text-muted-foreground mt-1">5+ = ×1.5, 10+ = ×2, 15+ = ×3</p>
                </div>
              </div>

              <Button
                onClick={startMarathon}
                disabled={isLoading}
                className="btn-bounce bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 h-12 px-8 text-lg font-semibold"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                    Загрузка...
                  </span>
                ) : (
                  <>
                    <Flame className="mr-2 h-5 w-5" />
                    Начать марафон
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              PLAYING STATE
          ═══════════════════════════════════════════════════════════════════════ */}
          {state === "playing" && challenge && (
            <motion.div
              key={`playing-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitionConfig}
            >
              {/* ─── Top Bar: Progress + Lives + Multiplier + Timer ─── */}
              <div className="glass rounded-2xl p-4 mb-4">
                {/* Progress bar */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {currentIndex + 1}/{challenges.length}
                  </span>
                  <div className="flex-1 mx-3">
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                        initial={false}
                        animate={{ width: `${((currentIndex + (resultState === "correct" ? 1 : 0)) / challenges.length) * 100}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(((currentIndex + (resultState === "correct" ? 1 : 0)) / challenges.length) * 100)}%
                  </span>
                </div>

                {/* Lives + Multiplier + Timer row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={
                          i < lives
                            ? { scale: 1, opacity: 1 }
                            : { scale: 0.8, opacity: 0.2 }
                        }
                        transition={{ duration: 0.3 }}
                      >
                        <Heart
                          className={cn(
                            "h-5 w-5",
                            i < lives ? "fill-red-500 text-red-500" : "fill-white/5 text-white/20"
                          )}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Multiplier */}
                  <motion.div
                    key={currentMultiplier}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, type: "spring" }}
                    className={cn(
                      "text-lg font-bold",
                      getMultiplierColor(currentMultiplier)
                    )}
                  >
                    {getMultiplierLabel(currentMultiplier)}
                  </motion.div>

                  {/* Timer */}
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Timer className="h-4 w-4" />
                    <span className="font-mono">{formatTimeSpent(elapsedSeconds)}</span>
                  </div>
                </div>

                {/* Streak indicator */}
                {currentStreak > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Flame className={cn("h-4 w-4", getMultiplierColor(currentMultiplier))} />
                    <span className={cn("text-sm font-medium", getMultiplierColor(currentMultiplier))}>
                      Серия: {currentStreak}
                    </span>
                    {currentStreak >= 5 && currentStreak < 10 && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] ml-1">×1.5</Badge>
                    )}
                    {currentStreak >= 10 && currentStreak < 15 && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] ml-1">×2.0</Badge>
                    )}
                    {currentStreak >= 15 && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] ml-1">×3.0</Badge>
                    )}
                  </motion.div>
                )}
              </div>

              {/* ─── Challenge Header ─── */}
              <div className="glass rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-lg">{categoryEmoji(challenge.category)}</span>
                  <Badge variant="outline" className={difficultyBadgeClass(challenge.difficulty)}>
                    {difficultyLabel(challenge.difficulty)}
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10">
                    {categoryLabel(challenge.category)}
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10">
                    {typeLabel(challenge.type)}
                  </Badge>
                </div>

                <h2 className="text-xl font-bold mb-1">{challenge.title}</h2>
                <p className="text-sm text-muted-foreground">{challenge.description}</p>

                <Separator className="bg-white/5 my-3" />

                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    +{Math.round(challenge.xpReward * currentMultiplier)} XP
                  </span>
                  {currentMultiplier > 1.0 && (
                    <span className="text-xs text-amber-400 ml-1">
                      ({currentMultiplier}× множитель)
                    </span>
                  )}
                </div>
              </div>

              {/* ─── Challenge Content ─── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={challenge.id + (resultState || "")}
                  variants={contentVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transitionConfig}
                >
                  {/* Correct result */}
                  {resultState === "correct" && (
                    <div className="glass rounded-2xl p-6 mb-6 border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center justify-center mb-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20"
                        >
                          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                        </motion.div>
                      </div>
                      <h3 className="text-xl font-bold text-emerald-400 text-center mb-2">Правильно! 🎉</h3>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Zap className="h-5 w-5 text-amber-400" />
                        <span className="text-lg font-bold text-amber-400">
                          +{Math.round(challenge.xpReward * currentMultiplier)} XP
                        </span>
                      </div>
                      {challenge.explanation && (
                        <div className="rounded-lg bg-white/5 border border-white/5 p-3 mt-3">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Пояснение:</p>
                          <p className="text-sm text-foreground/90">{challenge.explanation}</p>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground text-center mt-3">Следующая задача...</p>
                    </div>
                  )}

                  {/* Wrong result */}
                  {resultState === "wrong" && (
                    <div className="glass rounded-2xl p-6 mb-6 border border-red-500/30 bg-red-500/5">
                      <div className="flex items-center justify-center mb-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20"
                        >
                          <X className="h-7 w-7 text-red-400" />
                        </motion.div>
                      </div>
                      <h3 className="text-xl font-bold text-red-400 text-center mb-2">Неправильно 😔</h3>
                      <p className="text-sm text-muted-foreground text-center mb-2">
                        Жизней осталось: {lives}
                      </p>
                      {challenge.explanation && (
                        <div className="rounded-lg bg-white/5 border border-white/5 p-3 mt-3">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Пояснение:</p>
                          <p className="text-sm text-foreground/90">{challenge.explanation}</p>
                        </div>
                      )}
                      {lives > 0 ? (
                        <p className="text-sm text-muted-foreground text-center mt-3">Следующая задача...</p>
                      ) : (
                        <p className="text-sm text-red-400 text-center mt-3">Жизни закончились!</p>
                      )}
                    </div>
                  )}

                  {/* Active challenge */}
                  {!resultState && (
                    <div className="glass rounded-2xl p-6 mb-6">
                      {parsedContent?.text && (
                        <div className="mb-6">
                          <p className="text-foreground leading-relaxed">{parsedContent.text}</p>
                        </div>
                      )}

                      {parsedContent?.code && (
                        <div className="rounded-lg bg-black/40 border border-white/5 p-4 mb-6 overflow-x-auto">
                          <pre className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                            {parsedContent.code}
                          </pre>
                        </div>
                      )}

                      {challenge.type === "multiple_choice" && (
                        <MultipleChoice
                          shuffledOptions={shuffledOptions}
                          value={multipleChoiceAnswer}
                          onChange={setMultipleChoiceAnswer}
                        />
                      )}

                      {challenge.type === "ordering" && (
                        <OrderingChallenge
                          items={parsedOrderingOptions}
                          value={orderingAnswer}
                          onChange={setOrderingAnswer}
                          hints={parsedHints}
                        />
                      )}

                      {challenge.type === "workflow_build" && (
                        <OrderingChallenge
                          items={parsedOrderingOptions}
                          value={workflowAnswer}
                          onChange={setWorkflowAnswer}
                          hints={parsedHints}
                        />
                      )}

                      <div className="mt-6 flex justify-end">
                        <Button
                          onClick={handleSubmit}
                          disabled={isSubmitting || !hasAnswer}
                          className="btn-bounce bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                              Проверка...
                            </span>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Ответить
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              GAME OVER SCREEN
          ═══════════════════════════════════════════════════════════════════════ */}
          {state === "gameover" && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
            >
              {/* Trophy icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 mb-6"
                style={{ boxShadow: "0 0 30px rgba(245, 158, 11, 0.2)" }}
              >
                <Trophy className="h-10 w-10 text-amber-400" />
              </motion.div>

              <h2 className="text-3xl font-bold mb-2">
                {displayCorrectCount >= challenges.length && challenges.length > 0 ? "🎉 Отличный марафон!" : "Марафон завершён!"}
              </h2>
              <p className="text-muted-foreground mb-8">
                {lives <= 0 ? "Жизни закончились" : "Все задачи пройдены"}
              </p>

              {/* Stats Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-6 w-full max-w-md mb-8"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{displayCorrectCount}</p>
                    <p className="text-xs text-muted-foreground">Правильных</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{displayTotalAttempts}</p>
                    <p className="text-xs text-muted-foreground">Всего попыток</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{finalAccuracy}%</p>
                    <p className="text-xs text-muted-foreground">Точность</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-400">{displayLongestStreak}</p>
                    <p className="text-xs text-muted-foreground">Макс. серия</p>
                  </div>
                </div>

                <Separator className="bg-white/5 my-4" />

                {/* XP earned with multiplier */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Zap className="h-5 w-5 text-amber-400" />
                    <span className="text-3xl font-bold text-amber-400">+{xpEarned} XP</span>
                  </div>
                  {finalMultiplier > 1.0 && (
                    <p className="text-sm text-muted-foreground">
                      Множитель серии: <span className={cn("font-bold", getMultiplierColor(finalMultiplier))}>{getMultiplierLabel(finalMultiplier)}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Время: {formatTimeSpent(elapsedSeconds)}
                  </p>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={startMarathon}
                  className="btn-bounce bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Попробовать снова
                </Button>
                <Link href="/challenges">
                  <Button variant="outline" className="border-white/10 hover:bg-white/5">
                    <Target className="mr-2 h-4 w-4" />
                    К задачам
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
