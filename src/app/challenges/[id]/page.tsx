"use client";

import { Component, type ReactNode } from "react";
import { useEffect, useState, useCallback, useMemo, useRef, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { MultipleChoice, shuffleOptions } from "@/components/challenges/multiple-choice";
import { OrderingChallenge } from "@/components/challenges/ordering-challenge";
import { ChallengeResult } from "@/components/challenges/challenge-result";
import { XPAnimation } from "@/components/gamification/xp-animation";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { AchievementUnlockModal, type AchievementData } from "@/components/gamification/achievement-unlock-modal";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Zap, ArrowLeft, Send, CheckCircle2, Timer, Trophy, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getCachedChallenge, setCachedChallenge } from "@/lib/challenge-cache";

// ─── TOTAL IMMUNITY: Error Boundary ──────────────────────────────
// Wraps the entire page content. If ANYTHING crashes during render,
// the page STILL opens in the browser and shows the error on screen.
class ChallengeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <div className="p-8 max-w-2xl mx-auto my-10 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <h1 className="text-xl font-bold mb-2">Критическая ошибка сервера</h1>
          <p className="font-mono text-sm">{err?.message || String(err)}</p>
          <p className="text-xs text-gray-500 mt-4">Стек: {err?.stack || ""}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  // correctAnswer is NOT sent from server — validated server-side on submit
  explanation: string | null;
  hints: string | null;
  validationType: string;
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
  newAchievements?: AchievementData[];
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

// ★★★ SLIDE TRANSITIONS: Old card slides out left, new slides in from right ★★★
const contentVariants = {
  enter: {
    opacity: 0,
    translateX: "100%",
  },
  center: {
    opacity: 1,
    translateX: "0%",
  },
  exit: {
    opacity: 0,
    translateX: "-100%",
  },
};

// 250ms smooth slide with ease-in-out
const transitionConfig = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// ─── Inner component (the actual page logic, wrapped by ErrorBoundary) ──
function ChallengePageInner() {

  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  // ★ Current challenge ID — can differ from URL during state transitions
  const [activeId, setActiveId] = useState(challengeId);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  // Answer states
  const [multipleChoiceAnswer, setMultipleChoiceAnswer] = useState<string | null>(null);
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

  // Achievement unlock modal state
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);

  // Process achievement queue sequentially (2s delay between each)
  useEffect(() => {
    if (achievementQueue.length > 0 && !showAchievementModal) {
      const next = achievementQueue[0];
      setCurrentAchievement(next);
      setShowAchievementModal(true);
      // After 4s (modal auto-close) + 2s delay, process next
      const timer = setTimeout(() => {
        setShowAchievementModal(false);
        // Small delay before showing next achievement
        setTimeout(() => {
          setCurrentAchievement(null);
          setAchievementQueue((prev) => prev.slice(1));
        }, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievementQueue, showAchievementModal]);

  // Hearts state
  const [hearts, setHearts] = useState(3);
  const [nextHeartAt, setNextHeartAt] = useState<string | null>(null);

  // Navigation
  const [challengeList, setChallengeList] = useState<ChallengeListItem[]>([]);
  const [nextChallengeId, setNextChallengeId] = useState<string | null>(null);
  const startTimeRef = useRef(Date.now());

  // ★ Track if this is the initial load (for skeleton)
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ★ Guard: ignore URL param changes during state transitions
  const isTransitioningRef = useRef(false);

  // Timer
  useEffect(() => {
    if (!challenge || result || challenge.isSolved || onCooldown) return;
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge, result, onCooldown]);

  // ★★★ CORE: Load challenge data — CACHE FIRST ★★★
  useEffect(() => {
    // Skip if we're in a state transition (activeId already set by handleNext)
    if (isTransitioningRef.current) {
      isTransitioningRef.current = false;
      return;
    }

    // Check global cache (instant!)
    const cached = getCachedChallenge(challengeId);
    if (cached) {
      applyChallengeData(cached);
      setActiveId(challengeId);
      setIsInitialLoad(false);
      return;
    }

    // Cache miss — fetch from API
    fetchChallengeFromAPI(challengeId);
  }, [challengeId]);

  /** Apply challenge data to state */
  function applyChallengeData(data: ChallengeData) {
    setChallenge(data);

    // Fetch user session in background (once)
    if (!userId) {
      fetch("/api/auth/session")
        .then((r) => r.json())
        .then((session) => {
          const uid = session?.user?.id;
          if (uid) setUserId(uid);
        })
        .catch(() => {});
    }
  }

  /** Fetch challenge from API when cache misses */
  async function fetchChallengeFromAPI(id: string) {
    try {
      const res = await fetch(`/api/challenges/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCachedChallenge(id, data);
        applyChallengeData(data);
        setActiveId(id);
      } else {
        setError("Задача не найдена");
      }
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setIsInitialLoad(false);
    }
  }

  // Fetch challenge list
  useEffect(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data) => {
        // API returns { challenges: [...], difficultyBoost } or flat array
        const list: ChallengeListItem[] = Array.isArray(data) ? data : (data.challenges || []);
        setChallengeList(list);
      })
      .catch(() => {});
  }, []);

  // Calculate next unsolved challenge & preload into cache
  useEffect(() => {
    if (!challenge || challengeList.length === 0) return;

    const now = new Date();
    const sorted = [...challengeList].sort((a, b) => {
      const aSolved = a.isSolved === true;
      const bSolved = b.isSolved === true;
      const aBlocked = !aSolved && !!a.cooldownUntil && new Date(a.cooldownUntil) > now;
      const bBlocked = !bSolved && !!b.cooldownUntil && new Date(b.cooldownUntil) > now;
      const aTier = aSolved ? 2 : aBlocked ? 1 : 0;
      const bTier = bSolved ? 2 : bBlocked ? 1 : 0;
      if (aTier !== bTier) return aTier - bTier;
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

    // Preload next 2 challenges into global cache
    const idsToPreload: string[] = [nextId].filter(Boolean) as string[];
    if (nextId) {
      const nextIdx = sorted.findIndex((c) => c.id === nextId);
      for (let i = nextIdx + 1; i < sorted.length; i++) {
        if (sorted[i].isSolved !== true) {
          idsToPreload.push(sorted[i].id);
          break;
        }
      }
    }
    idsToPreload.forEach((id) => {
      if (!getCachedChallenge(id)) {
        fetch(`/api/challenges/${id}`)
          .then((r) => r.json())
          .then((data) => setCachedChallenge(id, data))
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
      case "ordering": return orderingAnswer.length > 0 ? orderingAnswer : null;
      case "workflow_build": return workflowAnswer.length > 0 ? workflowAnswer : null;
      default: return null;
    }
  }, [challenge, multipleChoiceAnswer, orderingAnswer, workflowAnswer]);

  // Reset all states for a new challenge
  const resetForNewChallenge = useCallback(() => {
    setMultipleChoiceAnswer(null);
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
          // Update cache
          setCachedChallenge(challenge.id, { ...challenge, isSolved: true });
          if (data.xpEarned > 0) setShowXpAnimation(true);
          if (data.leveledUp) {
            setLevelUpData({
              level: data.newLevel,
              previousLevel: data.newLevel - 1,
              xpEarned: data.xpEarned,
            });
            setShowLevelUp(true);
          }
          // Queue achievement unlock modals
          if (data.newAchievements && data.newAchievements.length > 0) {
            setAchievementQueue(data.newAchievements);
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

  // ★★★ DUOLINGO PATTERN: Navigate to next via STATE TRANSITION ★★★
  // This is the KEY difference: we change state, NOT the route
  // The page never unmounts = zero latency = instant transition
  const handleNext = useCallback(() => {
    if (!nextChallengeId) return;

    // 1. Guard: prevent the useEffect from re-running when URL changes
    isTransitioningRef.current = true;

    // 3. Check cache for instant data
    const cached = getCachedChallenge(nextChallengeId);
    if (cached) {
      // ★ Cache HIT: apply data INSTANTLY in the same render
      resetForNewChallenge();
      setChallenge(cached);
      setActiveId(nextChallengeId);
      setError(null);
    } else {
      // ★ Cache MISS: keep old challenge visible, fetch in background
      resetForNewChallenge();
      // Don't null challenge! Old content stays visible
      setActiveId(nextChallengeId);
      fetch(`/api/challenges/${nextChallengeId}`)
        .then((r) => r.json())
        .then((data) => {
          setCachedChallenge(nextChallengeId, data);
          setChallenge(data);
        })
        .catch(() => setError("Ошибка загрузки"));
    }

    // 4. Update URL (no navigation, just URL change)
    startTransition(() => {
      router.replace(`/challenges/${nextChallengeId}`);
    });

    // 5. Background refresh (non-blocking)
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
        const list: ChallengeListItem[] = Array.isArray(listData) ? listData : (listData.challenges || []);
        setChallengeList(list);
      })
      .catch(() => {});
  }, [nextChallengeId, router, resetForNewChallenge]);

  // ★ Swipe handlers disabled — removed touch tracking

  // === CONDITIONAL RETURNS ===

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

  // ★ Structured skeleton — only on very first load when cache misses
  // Same layout as real page = no layout shift when data arrives
  if (!challenge && isInitialLoad) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl animate-in fade-in duration-200">
          <div className="h-5 w-24 mb-4 rounded bg-white/5" />
          <div className="glass rounded-2xl p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-5 rounded bg-white/5" />
              <div className="h-5 w-16 rounded bg-white/5" />
              <div className="h-5 w-20 rounded bg-white/5" />
            </div>
            <div className="h-7 w-3/4 rounded bg-white/5 mb-2" />
            <div className="h-4 w-full rounded bg-white/5" />
            <div className="h-px bg-white/5 my-4" />
            <div className="flex justify-between">
              <div className="h-5 w-20 rounded bg-white/5" />
              <div className="h-5 w-24 rounded bg-white/5" />
            </div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="h-4 w-full rounded bg-white/5 mb-3" />
            <div className="h-4 w-5/6 rounded bg-white/5 mb-3" />
            <div className="h-4 w-4/6 rounded bg-white/5 mb-6" />
            <div className="space-y-2 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-white/5" />
              ))}
            </div>
            <div className="flex justify-end">
              <div className="h-10 w-28 rounded-lg bg-white/5" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!challenge) return null;

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
      <div className="mx-auto max-w-3xl relative">
        {/* ★ Swipe zone wraps only the challenge content area, NOT header/hearts */}
        <div>
        <XPAnimation amount={result?.xpEarned || 0} show={showXpAnimation} onComplete={() => setShowXpAnimation(false)} />
        <LevelUpModal
          show={showLevelUp}
          level={levelUpData.level}
          previousLevel={levelUpData.previousLevel}
          xpEarned={levelUpData.xpEarned}
          onClose={() => setShowLevelUp(false)}
        />
        <AchievementUnlockModal
          show={showAchievementModal}
          achievement={currentAchievement}
          onClose={() => setShowAchievementModal(false)}
        />

        {/* Back button */}
        <Link
          href="/challenges"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          onClick={() => {
            document.documentElement.classList.remove("slide-forward");
            document.documentElement.classList.add("slide-back");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Все задачи
        </Link>

        {/* ═══ LAYER 1: STABLE HEADER ═══ */}
        <div className="glass rounded-2xl p-6 mb-4">
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

        {/* ═══ LAYER 2: ANIMATED CONTENT ═══ */}
        {/* CSS containment prevents layout reflow during transitions */}
        <div style={{ minHeight: 500, position: "relative", overflow: "hidden" }}>
        {/* key=activeId — changes trigger AnimatePresence animation via STATE, not route */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transitionConfig}
          >
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
                      className="btn-bounce bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
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

            {/* Challenge Content — relative container for result overlay */}
            <div className="relative">
            {/* Active challenge form */}
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
                        Отправить
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Result overlay — fades in on top of challenge content, no layout shift */}
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-10 flex items-start justify-center pt-4"
              >
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
              </motion.div>
            )}
            </div>{/* end relative container */}
          </motion.div>
        </AnimatePresence>
        </div>{/* end min-height wrapper */}
        </div>{/* end content wrapper */}

        {/* Swipe indicator removed — swipe disabled */}
      </div>
    </AppLayout>
  );
}

// ─── Export: Page wrapped in ErrorBoundary (TOTAL IMMUNITY) ───────
// If ANYTHING crashes during render, the page STILL opens in the browser
// and shows the error directly on screen instead of silently blocking navigation.
export default function ChallengePage() {
  return (
    <ChallengeErrorBoundary>
      <ChallengePageInner />
    </ChallengeErrorBoundary>
  );
}
