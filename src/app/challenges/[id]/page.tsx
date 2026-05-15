"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { MultipleChoice, shuffleOptions } from "@/components/challenges/multiple-choice";
import { PromptFix } from "@/components/challenges/prompt-fix";
import { TextInput } from "@/components/challenges/text-input";
import { OrderingChallenge } from "@/components/challenges/ordering-challenge";
import { ChallengeResult } from "@/components/challenges/challenge-result";
import { XPAnimation } from "@/components/gamification/xp-animation";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Zap, ArrowLeft, Send, CheckCircle2, Timer, Trophy, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  isSolved?: boolean;
  cooldownUntil?: string | null;
  order?: number;
}

interface SubmitResult {
  isCorrect: boolean;
  xpEarned: number;
  baseXp: number;
  bonusXp: number;
  explanation: string | null;
  newLevel: number;
  newStreak: number;
  leveledUp: boolean;
  timeMultiplier?: number;
  heartsMultiplier?: number;
}

interface ChallengeListItem {
  id: string;
  isSolved?: boolean;
  cooldownUntil?: string | null;
  order?: number;
}

function formatCountdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "доступно";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes} мин`;
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}с`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}м ${s}с`;
}

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

// ★ Smooth page-turn animation variants
// Current task tilts and slides LEFT, new task comes from RIGHT — like a book page turn
const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "80%" : "-80%",
    opacity: 0,
    rotateY: direction > 0 ? 12 : -12,
    scale: 0.88,
    skewY: direction > 0 ? 2 : -2,
  }),
  center: {
    x: 0,
    opacity: 1,
    rotateY: 0,
    scale: 1,
    skewY: 0,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-60%" : "60%",
    opacity: 0,
    rotateY: direction > 0 ? -12 : 12,
    scale: 0.88,
    skewY: direction > 0 ? -2 : 2,
  }),
};

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  // Answer states
  const [multipleChoiceAnswer, setMultipleChoiceAnswer] = useState<string | null>(null);
  const [promptFixAnswer, setPromptFixAnswer] = useState("");
  const [textInputAnswer, setTextInputAnswer] = useState("");
  const [orderingAnswer, setOrderingAnswer] = useState<number[]>([]);
  const [workflowAnswer, setWorkflowAnswer] = useState<number[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);

  // Cooldown state
  const [onCooldown, setOnCooldown] = useState(false);
  const [cooldownText, setCooldownText] = useState<string>("");

  // Level-up modal state
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ level: 1, previousLevel: 1, xpEarned: 0 });

  // Hearts state
  const [hearts, setHearts] = useState(3);
  const [nextHeartAt, setNextHeartAt] = useState<string | null>(null);

  // Navigation & preloading
  const [challengeList, setChallengeList] = useState<ChallengeListItem[]>([]);
  const [nextChallengeId, setNextChallengeId] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const startTimeRef = useRef(Date.now());

  // ★ Transition guard — prevents fetchChallenge from re-running during animated transitions
  const isTransitioningRef = useRef(false);
  // Track the currently displayed challenge ID (may differ from URL during transition)
  const displayedIdRef = useRef<string>(challengeId);

  // ★ Preloaded challenge buffer — Map<id, data>
  const preloadedRef = useRef<Map<string, ChallengeData>>(new Map());

  // Track initial load (to show shimmer only on first load, not on transitions)
  const initialLoadDoneRef = useRef(false);

  // Timer: track elapsed time
  useEffect(() => {
    if (!challenge || result || challenge.isSolved || onCooldown) return;
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge, result, onCooldown]);

  // ★ Fetch challenge data — only on initial page load, NOT during transitions
  useEffect(() => {
    // Skip fetch if we're in the middle of a client-side transition
    if (isTransitioningRef.current) {
      isTransitioningRef.current = false;
      return;
    }

    async function fetchChallenge() {
      try {
        // Check preload buffer first (for browser back/forward navigation)
        const cached = preloadedRef.current.get(challengeId);
        if (cached) {
          displayedIdRef.current = challengeId;
          setChallenge(cached);
          if (cached.type === "prompt_fix") {
            try {
              const content = JSON.parse(cached.content);
              setPromptFixAnswer(content.originalPrompt || "");
            } catch {
              setPromptFixAnswer("");
            }
          }
          setIsLoading(false);
          initialLoadDoneRef.current = true;
          return;
        }

        setIsLoading(true);
        const res = await fetch(`/api/challenges/${challengeId}`);
        if (res.ok) {
          const data = await res.json();
          displayedIdRef.current = challengeId;
          setChallenge(data);

          // Also cache it in preload buffer
          preloadedRef.current.set(challengeId, data);

          const sessionRes = await fetch("/api/auth/session");
          if (sessionRes.ok) {
            const session = await sessionRes.json();
            const uid = (session?.user as Record<string, unknown>)?.id as string;
            if (uid) setUserId(uid);
          }

          if (data.type === "prompt_fix") {
            try {
              const content = JSON.parse(data.content);
              setPromptFixAnswer(content.originalPrompt || "");
            } catch {
              setPromptFixAnswer("");
            }
          }
        } else {
          setError("Задача не найдена");
        }
      } catch {
        setError("Ошибка загрузки");
      } finally {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      }
    }
    fetchChallenge();
  }, [challengeId]);

  // Fetch challenge list for "next" navigation
  useEffect(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data: ChallengeListItem[]) => {
        setChallengeList(data);
      })
      .catch(() => {});
  }, []);

  // Calculate next unsolved challenge & preload it
  useEffect(() => {
    if (!challenge || challengeList.length === 0) return;

    const sorted = [...challengeList].sort((a, b) => {
      const aSolved = a.isSolved === true;
      const bSolved = b.isSolved === true;
      if (aSolved && !bSolved) return 1;
      if (!aSolved && bSolved) return -1;
      return (a.order ?? 0) - (b.order ?? 0);
    });

    const currentIdx = sorted.findIndex((c) => c.id === challenge.id);
    let nextId: string | null = null;
    for (let i = currentIdx + 1; i < sorted.length; i++) {
      if (sorted[i].isSolved !== true) {
        nextId = sorted[i].id;
        break;
      }
    }
    if (!nextId) {
      for (let i = 0; i < currentIdx; i++) {
        if (sorted[i].isSolved !== true) {
          nextId = sorted[i].id;
          break;
        }
      }
    }
    setNextChallengeId(nextId);

    // ★ Preload the next challenge AND the one after into buffer
    const idsToPreload = [nextId];
    // Also find the one after next
    if (nextId) {
      const nextIdx = sorted.findIndex(c => c.id === nextId);
      for (let i = nextIdx + 1; i < sorted.length; i++) {
        if (sorted[i].isSolved !== true) {
          idsToPreload.push(sorted[i].id);
          break;
        }
      }
    }

    idsToPreload.forEach(id => {
      if (id && !preloadedRef.current.has(id)) {
        fetch(`/api/challenges/${id}`)
          .then((r) => r.json())
          .then((data) => {
            preloadedRef.current.set(id, data);
          })
          .catch(() => {});
      }
    });
  }, [challenge, challengeList]);

  // Fetch hearts
  useEffect(() => {
    fetch("/api/user/activity")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.hearts === "number") setHearts(data.hearts);
        if (data.nextHeartAt) setNextHeartAt(data.nextHeartAt);
      })
      .catch(() => {});
  }, []);

  // Update cooldown
  useEffect(() => {
    if (!challenge?.cooldownUntil || challenge.isSolved) {
      setOnCooldown(false);
      setCooldownText("");
      return;
    }
    const check = () => {
      const still = new Date(challenge.cooldownUntil!) > new Date();
      setOnCooldown(still);
      setCooldownText(formatCountdown(challenge.cooldownUntil!));
      return still;
    };
    check();
    const interval = setInterval(() => {
      if (!check()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge?.cooldownUntil, challenge?.isSolved]);

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

  const getAnswer = useCallback(() => {
    if (!challenge) return null;
    switch (challenge.type) {
      case "multiple_choice": return multipleChoiceAnswer;
      case "prompt_fix": return promptFixAnswer;
      case "text_input": return textInputAnswer;
      case "ordering": return orderingAnswer.length > 0 ? orderingAnswer : null;
      case "workflow_build": return workflowAnswer.length > 0 ? workflowAnswer : null;
      default: return null;
    }
  }, [challenge, multipleChoiceAnswer, promptFixAnswer, textInputAnswer, orderingAnswer, workflowAnswer]);

  // Reset all answer/submit states for a new challenge
  const resetForNewChallenge = useCallback(() => {
    setMultipleChoiceAnswer(null);
    setPromptFixAnswer("");
    setTextInputAnswer("");
    setOrderingAnswer([]);
    setWorkflowAnswer([]);
    setIsSubmitting(false);
    setResult(null);
    setShowXpAnimation(false);
    setSubmitError(null);
    setTimeSpent(0);
    setOnCooldown(false);
    setCooldownText("");
    startTimeRef.current = Date.now();
  }, []);

  const handleSubmit = async () => {
    const answer = getAnswer();
    if (!answer || !challenge) return;
    if (Array.isArray(answer) && answer.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const spent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const res = await fetch(`/api/challenges/${challenge.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, timeSpent: spent }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.isCorrect) {
          setChallenge({ ...challenge, isSolved: true });
          if (data.xpEarned > 0) {
            setShowXpAnimation(true);
          }
          if (data.leveledUp) {
            setLevelUpData({
              level: data.newLevel,
              previousLevel: data.newLevel - 1,
              xpEarned: data.xpEarned,
            });
            setShowLevelUp(true);
          }
        } else {
          setHearts((h) => Math.max(0, h - 1));
        }
      } else {
        const errData = await res.json();
        setSubmitError(errData.error || "Ошибка отправки");
        if (errData.alreadySolved) {
          setChallenge({ ...challenge, isSolved: true });
        }
        if (errData.cooldownUntil) {
          setChallenge({ ...challenge, cooldownUntil: errData.cooldownUntil });
        }
      }
    } catch {
      setSubmitError("Ошибка сети");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ★ Navigate to next challenge — SEAMLESS with preloaded data
  // The key insight: we do NOT show any loading state.
  // We apply preloaded data instantly, update URL, and animate.
  const handleNext = useCallback(async () => {
    if (!nextChallengeId || isTransitioningRef.current) return;

    isTransitioningRef.current = true;

    // 1. Trigger exit animation for current card
    setDirection(1);
    setAnimKey((k) => k + 1);

    // 2. Wait for the exit animation to play
    await new Promise((r) => setTimeout(r, 280));

    // 3. Get preloaded data
    const preloaded = preloadedRef.current.get(nextChallengeId);

    if (preloaded) {
      // ★ INSTANT — apply preloaded data, NO loading shimmer ever
      displayedIdRef.current = nextChallengeId;
      resetForNewChallenge();
      setChallenge(preloaded);
      setError(null);

      if (preloaded.type === "prompt_fix") {
        try {
          const content = JSON.parse(preloaded.content);
          setPromptFixAnswer(content.originalPrompt || "");
        } catch {
          setPromptFixAnswer("");
        }
      }

      // Update URL without triggering a re-fetch (isTransitioningRef guards the useEffect)
      router.replace(`/challenges/${nextChallengeId}`);

      // Background: refresh challenge list & hearts (non-blocking)
      fetch("/api/user/activity")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.hearts === "number") setHearts(d.hearts);
          if (d.nextHeartAt) setNextHeartAt(d.nextHeartAt);
        })
        .catch(() => {});

      fetch("/api/challenges")
        .then((r) => r.json())
        .then((listData) => {
          setChallengeList(listData);
        })
        .catch(() => {});

      // Allow future navigations after a short delay
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 100);
    } else {
      // Fallback: no preloaded data — fetch with minimal flash
      displayedIdRef.current = nextChallengeId;
      resetForNewChallenge();
      setError(null);
      // Don't show shimmer — keep showing the last card position, just dimmed

      try {
        const res = await fetch(`/api/challenges/${nextChallengeId}`);
        if (res.ok) {
          const data = await res.json();
          setChallenge(data);
          preloadedRef.current.set(nextChallengeId, data);

          if (data.type === "prompt_fix") {
            try {
              const content = JSON.parse(data.content);
              setPromptFixAnswer(content.originalPrompt || "");
            } catch {
              setPromptFixAnswer("");
            }
          }
        }
      } catch {
        setError("Ошибка загрузки");
      }

      router.replace(`/challenges/${nextChallengeId}`);

      fetch("/api/user/activity")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.hearts === "number") setHearts(d.hearts);
          if (d.nextHeartAt) setNextHeartAt(d.nextHeartAt);
        })
        .catch(() => {});

      fetch("/api/challenges")
        .then((r) => r.json())
        .then((listData) => {
          setChallengeList(listData);
        })
        .catch(() => {});

      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 100);
    }
  }, [nextChallengeId, router, resetForNewChallenge]);

  // === CONDITIONAL RETURNS ===

  // Only show shimmer on the very first load (not during transitions)
  if (isLoading && !initialLoadDoneRef.current) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl">
          <div className="glass rounded-2xl p-8 shimmer h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error && !challenge) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl text-center py-20">
          <p className="text-xl text-muted-foreground">{error || "Задача не найдена"}</p>
          <Link href="/challenges">
            <Button variant="outline" className="mt-4 border-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К списку задач
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!challenge) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl">
          <div className="glass rounded-2xl p-8 shimmer h-96" />
        </div>
      </AppLayout>
    );
  }

  // Safe parsing
  const parsedHints = (() => {
    if (!challenge.hints) return null;
    try { return JSON.parse(challenge.hints); } catch { return [challenge.hints]; }
  })();

  const parsedContent = (() => {
    try { return JSON.parse(challenge.content); } catch { return { text: challenge.content }; }
  })();

  const isSolved = challenge.isSolved;

  const hasAnswer = (() => {
    switch (challenge.type) {
      case "multiple_choice": return multipleChoiceAnswer !== null;
      case "prompt_fix": return promptFixAnswer.trim().length > 0;
      case "text_input": return textInputAnswer.trim().length > 0;
      case "ordering":
      case "workflow_build": return orderingAnswer.length > 0 || workflowAnswer.length > 0;
      default: return false;
    }
  })();

  const isQuick = timeSpent > 0 && timeSpent < 30;

  const currentTimeMultiplier = (() => {
    if (timeSpent <= 0) return 1.0;
    if (timeSpent <= 30) return 1.0;
    const blocks = Math.floor((timeSpent - 30) / 30);
    return Math.max(1.0 - blocks * 0.1, 0.1);
  })();

  const noHearts = hearts <= 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl relative overflow-hidden" style={{ perspective: "1200px" }}>
        <XPAnimation amount={result?.xpEarned || 0} show={showXpAnimation} onComplete={() => setShowXpAnimation(false)} />
        <LevelUpModal
          show={showLevelUp}
          level={levelUpData.level}
          previousLevel={levelUpData.previousLevel}
          xpEarned={levelUpData.xpEarned}
          onClose={() => setShowLevelUp(false)}
        />

        {/* Back button */}
        <Link href="/challenges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Все задачи
        </Link>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={animKey || challenge.id}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 180, damping: 26 },
              opacity: { duration: 0.22 },
              rotateY: { duration: 0.3 },
              scale: { duration: 0.22 },
              skewY: { duration: 0.3 },
            }}
            style={{ transformOrigin: "center center" }}
          >
            {/* Challenge Header */}
            <div className="glass rounded-2xl p-6 mb-6">
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
                {isSolved && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Решено
                  </Badge>
                )}
              </div>

              <h1 className={cn("text-2xl font-bold mb-2", isSolved && "text-muted-foreground")}>
                {challenge.title}
              </h1>
              <p className="text-muted-foreground">{challenge.description}</p>

              <Separator className="bg-white/5 my-4" />

              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-1.5", isSolved ? "text-muted-foreground/50" : "text-emerald-400")}>
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    +{Math.round(challenge.xpReward * currentTimeMultiplier * (noHearts ? 0.5 : 1))} XP
                  </span>
                  {currentTimeMultiplier < 1.0 && !result && !isSolved && (
                    <span className="text-xs text-amber-400 ml-1">
                      ⏱ {Math.round(currentTimeMultiplier * 100)}%
                    </span>
                  )}
                  {isQuick && !result && (
                    <span className="text-xs text-amber-400 ml-1">⚡ Макс. XP!</span>
                  )}
                  {noHearts && !result && !isSolved && (
                    <span className="text-xs text-red-400 ml-1">💔 -50% XP</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!result && !isSolved && !onCooldown && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Timer className="h-4 w-4" />
                      <span className={cn("font-mono", isQuick && "text-amber-400", timeSpent > 30 && timeSpent <= 60 && "text-amber-400/70", timeSpent > 60 && "text-red-400/70")}>
                        {formatTimeSpent(timeSpent)}
                      </span>
                    </div>
                  )}
                  {!isSolved && !onCooldown && (
                    <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
                  )}
                </div>
              </div>
            </div>

            {/* SOLVED OVERLAY */}
            {isSolved && !result && (
              <div className="glass rounded-2xl p-8 mb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                    <Trophy className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-2">Задача решена</h2>
                <p className="text-muted-foreground mb-4">
                  Вы уже правильно решили эту задачу. Повторная отправка недоступна.
                </p>
                {challenge.explanation && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-left mb-4">
                    <p className="text-xs text-emerald-400 mb-1 font-medium">Пояснение:</p>
                    <p className="text-sm text-muted-foreground">{challenge.explanation}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 justify-center">
                  <Link href="/challenges">
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      К списку задач
                    </Button>
                  </Link>
                  {nextChallengeId && (
                    <Button
                      onClick={handleNext}
                      className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      Следующая задача
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* COOLDOWN OVERLAY */}
            {onCooldown && !isSolved && !result && (
              <div className="glass rounded-2xl p-8 mb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                    <Timer className="h-8 w-8 text-amber-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-2">Ответ был неверным</h2>
                <p className="text-muted-foreground mb-2">
                  Повторная попытка будет доступна через:
                </p>
                <p className="text-2xl font-bold text-amber-400 mb-4">{cooldownText}</p>
                <p className="text-sm text-muted-foreground">
                  Пока ожидаете — попробуйте другие задачи
                </p>
                <Link href="/challenges">
                  <Button variant="outline" className="mt-4 border-white/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    К списку задач
                  </Button>
                </Link>
              </div>
            )}

            {/* Challenge Content */}
            {!result && !isSolved && !onCooldown && (
              <div className="glass rounded-2xl p-6 mb-6">
                {parsedContent.text && (
                  <div className="mb-6">
                    <p className="text-foreground leading-relaxed">{parsedContent.text}</p>
                  </div>
                )}

                {parsedContent.code && (
                  <div className="rounded-lg bg-black/40 border border-white/5 p-4 mb-6 overflow-x-auto">
                    <pre className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                      {parsedContent.code}
                    </pre>
                  </div>
                )}

                {challenge.type === "multiple_choice" && (
                  <MultipleChoice shuffledOptions={shuffledOptions} value={multipleChoiceAnswer} onChange={setMultipleChoiceAnswer} />
                )}

                {challenge.type === "prompt_fix" && (
                  <PromptFix originalPrompt={parsedContent.originalPrompt || ""} value={promptFixAnswer} onChange={setPromptFixAnswer} hints={parsedHints} />
                )}

                {challenge.type === "text_input" && (
                  <TextInput value={textInputAnswer} onChange={setTextInputAnswer} placeholder={parsedContent.placeholder || "Введите ответ..."} hints={parsedHints} />
                )}

                {challenge.type === "ordering" && (
                  <OrderingChallenge items={parsedOrderingOptions} value={orderingAnswer} onChange={setOrderingAnswer} hints={parsedHints} />
                )}

                {challenge.type === "workflow_build" && (
                  <OrderingChallenge items={parsedOrderingOptions} value={workflowAnswer} onChange={setWorkflowAnswer} hints={parsedHints} />
                )}

                {submitError && (
                  <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-sm text-red-400">{submitError}</p>
                  </div>
                )}

                {noHearts && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-sm text-amber-400">
                      ⚠️ Жизни истрачены! Решать можно, но опыт — 50%
                    </p>
                  </div>
                )}

                {currentTimeMultiplier < 1.0 && !noHearts && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-sm text-amber-400">
                      ⏱ Опыт уменьшается: {Math.round(currentTimeMultiplier * 100)}% от базового. Решайте быстрее!
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !hasAnswer}
                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                        Проверка...
                      </span>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Отправить
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <ChallengeResult
                isCorrect={result.isCorrect}
                xpEarned={result.xpEarned}
                baseXp={result.baseXp}
                bonusXp={result.bonusXp}
                explanation={result.explanation}
                newLevel={result.newLevel}
                newStreak={result.newStreak}
                leveledUp={result.leveledUp}
                timeMultiplier={result.timeMultiplier}
                heartsMultiplier={result.heartsMultiplier}
                onNext={handleNext}
                hasNext={!!nextChallengeId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
