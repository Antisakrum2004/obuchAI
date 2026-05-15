"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { MultipleChoice, shuffleOptions } from "@/components/challenges/multiple-choice";
import { PromptFix } from "@/components/challenges/prompt-fix";
import { TextInput } from "@/components/challenges/text-input";
import { OrderingChallenge } from "@/components/challenges/ordering-challenge";
import { ChallengeResult } from "@/components/challenges/challenge-result";
import { XPAnimation } from "@/components/gamification/xp-animation";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Zap, Clock, ArrowLeft, Send, CheckCircle2, Timer } from "lucide-react";
import { motion } from "framer-motion";
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
}

function formatCountdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "доступно";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes} мин`;
}

/**
 * Simple hash function to create a deterministic seed from userId + challengeId.
 * This ensures the same user sees the same option order for the same challenge,
 * but different users see different orders.
 */
function hashSeed(a: string, b: string): number {
  let hash = 0;
  const str = a + b;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  // Answer states — store ORIGINAL index for multiple_choice
  const [multipleChoiceAnswer, setMultipleChoiceAnswer] = useState<string | null>(null);
  const [promptFixAnswer, setPromptFixAnswer] = useState("");
  const [textInputAnswer, setTextInputAnswer] = useState("");
  const [orderingAnswer, setOrderingAnswer] = useState<number[]>([]);
  const [workflowAnswer, setWorkflowAnswer] = useState<number[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [startTime] = useState(Date.now());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cooldown state — tracks whether challenge is on cooldown (auto-updates)
  const [onCooldown, setOnCooldown] = useState(false);
  const [cooldownText, setCooldownText] = useState<string>("");

  // === ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS ===

  // Fetch challenge data
  useEffect(() => {
    async function fetchChallenge() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/challenges/${challengeId}`);
        if (res.ok) {
          const data = await res.json();
          setChallenge(data);

          // Get userId from session for seeded shuffle
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
      }
    }
    fetchChallenge();
  }, [challengeId]);

  // Update cooldown timer + onCooldown state every second
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

  // Shuffle multiple choice options deterministically based on userId + challengeId
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

  // For ordering/workflow: parse options
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
      case "multiple_choice":
        return multipleChoiceAnswer;
      case "prompt_fix":
        return promptFixAnswer;
      case "text_input":
        return textInputAnswer;
      case "ordering":
        return orderingAnswer.length > 0 ? orderingAnswer : null;
      case "workflow_build":
        return workflowAnswer.length > 0 ? workflowAnswer : null;
      default:
        return null;
    }
  }, [challenge, multipleChoiceAnswer, promptFixAnswer, textInputAnswer, orderingAnswer, workflowAnswer]);

  const handleSubmit = async () => {
    const answer = getAnswer();
    if (!answer || !challenge) return;
    // Extra guard: reject empty arrays
    if (Array.isArray(answer) && answer.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const res = await fetch(`/api/challenges/${challenge.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, timeSpent }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.isCorrect) {
          // Mark as solved locally so UI updates immediately
          setChallenge({ ...challenge, isSolved: true });
          if (data.xpEarned > 0) {
            setShowXpAnimation(true);
          }
        } else {
          // Wrong answer — set cooldown from server response
          // The submit API returns 200 with isCorrect: false
          // Cooldown is handled by the attempts table on the server side
        }
      } else {
        const errData = await res.json();
        setSubmitError(errData.error || "Ошибка отправки");
        // If already solved, update challenge state
        if (errData.alreadySolved) {
          setChallenge({ ...challenge, isSolved: true });
        }
        // If on cooldown, update
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

  const handleNext = () => {
    router.push("/challenges");
  };

  // === CONDITIONAL RETURNS AFTER ALL HOOKS ===

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl">
          <div className="glass rounded-2xl p-8 shimmer h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error || !challenge) {
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

  // Safe parsing — no hooks after this point
  const parsedHints = (() => {
    if (!challenge.hints) return null;
    try {
      return JSON.parse(challenge.hints);
    } catch {
      // hints might be a plain string, return as single-item array
      return [challenge.hints];
    }
  })();

  const parsedContent = (() => {
    try {
      return JSON.parse(challenge.content);
    } catch {
      return { text: challenge.content };
    }
  })();

  const isSolved = challenge.isSolved;

  // Check if answer is provided
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl relative">
        <XPAnimation amount={result?.xpEarned || 0} show={showXpAnimation} onComplete={() => setShowXpAnimation(false)} />

        {/* Back button */}
        <Link href="/challenges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Все задачи
        </Link>

        {/* Challenge Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-6"
        >
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
              <span className="text-sm font-semibold">+{challenge.xpReward} XP</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Время не ограничено</span>
            </div>
          </div>
        </motion.div>

        {/* SOLVED OVERLAY */}
        {isSolved && !result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 mb-6 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
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
            <Link href="/challenges">
              <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                <ArrowLeft className="mr-2 h-4 w-4" />
                К списку задач
              </Button>
            </Link>
          </motion.div>
        )}

        {/* COOLDOWN OVERLAY */}
        {onCooldown && !isSolved && !result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 mb-6 text-center"
          >
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
          </motion.div>
        )}

        {/* Challenge Content — only if NOT solved and NOT on cooldown */}
        {!result && !isSolved && !onCooldown && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 mb-6"
          >
            {/* Question text */}
            {parsedContent.text && (
              <div className="mb-6">
                <p className="text-foreground leading-relaxed">{parsedContent.text}</p>
              </div>
            )}

            {/* Code block if present */}
            {parsedContent.code && (
              <div className="rounded-lg bg-black/40 border border-white/5 p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                  {parsedContent.code}
                </pre>
              </div>
            )}

            {/* Type-specific UI */}
            {challenge.type === "multiple_choice" && (
              <MultipleChoice
                shuffledOptions={shuffledOptions}
                value={multipleChoiceAnswer}
                onChange={setMultipleChoiceAnswer}
              />
            )}

            {challenge.type === "prompt_fix" && (
              <PromptFix
                originalPrompt={parsedContent.originalPrompt || ""}
                value={promptFixAnswer}
                onChange={setPromptFixAnswer}
                hints={parsedHints}
              />
            )}

            {challenge.type === "text_input" && (
              <TextInput
                value={textInputAnswer}
                onChange={setTextInputAnswer}
                placeholder={parsedContent.placeholder || "Введите ответ..."}
                hints={parsedHints}
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

            {/* Submit error */}
            {submitError && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}

            {/* Submit Button */}
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
          </motion.div>
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
            onNext={handleNext}
          />
        )}
      </div>
    </AppLayout>
  );
}
