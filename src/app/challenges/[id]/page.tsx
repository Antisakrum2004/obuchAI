"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { MultipleChoice } from "@/components/challenges/multiple-choice";
import { PromptFix } from "@/components/challenges/prompt-fix";
import { TextInput } from "@/components/challenges/text-input";
import { OrderingChallenge } from "@/components/challenges/ordering-challenge";
import { ChallengeResult } from "@/components/challenges/challenge-result";
import { XPAnimation } from "@/components/gamification/xp-animation";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Zap, Clock, ArrowLeft, Send } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

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

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [startTime] = useState(Date.now());

  useEffect(() => {
    async function fetchChallenge() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/challenges/${challengeId}`);
        if (res.ok) {
          const data = await res.json();
          setChallenge(data);

          // Parse content
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
        return orderingAnswer;
      case "workflow_build":
        return workflowAnswer;
      default:
        return null;
    }
  }, [challenge, multipleChoiceAnswer, promptFixAnswer, textInputAnswer, orderingAnswer, workflowAnswer]);

  const handleSubmit = async () => {
    const answer = getAnswer();
    if (!answer || !challenge) return;

    setIsSubmitting(true);
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
        if (data.isCorrect && data.xpEarned > 0) {
          setShowXpAnimation(true);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    router.push("/challenges");
  };

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

  const parsedOptions = challenge.options ? JSON.parse(challenge.options) : [];
  const parsedHints = challenge.hints ? JSON.parse(challenge.hints) : null;
  const parsedContent = (() => {
    try {
      return JSON.parse(challenge.content);
    } catch {
      return { text: challenge.content };
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
          </div>

          <h1 className="text-2xl font-bold mb-2">{challenge.title}</h1>
          <p className="text-muted-foreground">{challenge.description}</p>

          <Separator className="bg-white/5 my-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-semibold">+{challenge.xpReward} XP</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Время не ограничено</span>
            </div>
          </div>
        </motion.div>

        {/* Challenge Content */}
        {!result && (
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
                options={parsedOptions}
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
                items={parsedOptions}
                value={orderingAnswer}
                onChange={setOrderingAnswer}
                hints={parsedHints}
              />
            )}

            {challenge.type === "workflow_build" && (
              <OrderingChallenge
                items={parsedOptions}
                value={workflowAnswer}
                onChange={setWorkflowAnswer}
                hints={parsedHints}
              />
            )}

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !getAnswer()}
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
