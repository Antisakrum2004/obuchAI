"use client";

import { cn } from "@/lib/utils";
import { Check, X, Zap, ArrowRight, Sparkles, Clock, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

interface ChallengeResultProps {
  isCorrect: boolean;
  xpEarned: number;
  baseXp: number;
  bonusXp: number;
  explanation: string | null;
  newLevel?: number;
  newStreak?: number;
  leveledUp: boolean;
  timeMultiplier?: number;
  heartsMultiplier?: number;
  onNext?: () => void;
  hasNext?: boolean;
  className?: string;
}

export function ChallengeResult({
  isCorrect,
  xpEarned,
  baseXp,
  bonusXp,
  explanation,
  newLevel,
  newStreak,
  leveledUp,
  timeMultiplier,
  heartsMultiplier,
  onNext,
  hasNext,
  className,
}: ChallengeResultProps) {
  const hasTimePenalty = timeMultiplier !== undefined && timeMultiplier < 1.0;
  const hasHeartsPenalty = heartsMultiplier !== undefined && heartsMultiplier < 1.0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl border p-6",
        isCorrect
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5",
        className
      )}
    >
      {/* Status Icon */}
      <div className="flex items-center justify-center mb-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full",
            isCorrect
              ? "bg-emerald-500/20"
              : "bg-red-500/20"
          )}
        >
          {isCorrect ? (
            <Check className="h-8 w-8 text-emerald-400" />
          ) : (
            <X className="h-8 w-8 text-red-400" />
          )}
        </motion.div>
      </div>

      {/* Result Text */}
      <div className="text-center mb-4">
        <h3
          className={cn(
            "text-xl font-bold",
            isCorrect ? "text-emerald-400" : "text-red-400"
          )}
        >
          {isCorrect ? "Правильно! 🎉" : "Неправильно 😔"}
        </h3>

        {isCorrect && xpEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 mt-2"
          >
            <Zap className="h-5 w-5 text-amber-400" />
            <span className="text-lg font-bold text-amber-400">+{xpEarned} XP</span>
          </motion.div>
        )}

        {/* XP breakdown */}
        {isCorrect && (hasTimePenalty || hasHeartsPenalty) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-2 text-sm space-y-1"
          >
            <p className="text-muted-foreground">
              Базовый опыт: {baseXp} XP
            </p>
            {hasTimePenalty && (
              <p className="text-amber-400 flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Скорость: {Math.round(timeMultiplier! * 100)}% → {Math.round(baseXp * timeMultiplier!)} XP
              </p>
            )}
            {hasHeartsPenalty && (
              <p className="text-red-400 flex items-center justify-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                Без жизней: {Math.round(heartsMultiplier! * 100)}% → {Math.round(baseXp * (timeMultiplier ?? 1) * heartsMultiplier!)} XP
              </p>
            )}
          </motion.div>
        )}

        {isCorrect && bonusXp > 0 && (
          <p className="text-sm text-purple-400 mt-1">
            <Sparkles className="inline h-3.5 w-3.5 mr-1" />
            Бонус за серию: +{bonusXp} XP
          </p>
        )}

        {leveledUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="mt-3 rounded-lg bg-purple-500/10 border border-purple-500/20 p-3"
          >
            <p className="gradient-text font-bold text-lg">🎉 Новый уровень: {newLevel ?? 1}!</p>
          </motion.div>
        )}

        {isCorrect && (newStreak ?? 0) > 0 && (
          <p className="text-sm text-amber-400 mt-2">
            🔥 Серия: {newStreak ?? 0} дней
          </p>
        )}
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="rounded-lg bg-white/5 border border-white/5 p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Пояснение:</p>
          <p className="text-sm text-foreground/90">{explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 justify-center">
        <Link href="/challenges">
          <Button variant="outline" className="border-white/10 hover:bg-white/5">
            К списку задач
          </Button>
        </Link>
        {isCorrect && hasNext && onNext && (
          <Button
            onClick={onNext}
            className="btn-bounce bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          >
            Следующая задача
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {!isCorrect && hasNext && onNext && (
          <Button
            onClick={onNext}
            className="btn-bounce bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          >
            Попробовать другую
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {!hasNext && (
          <Link href="/challenges">
            <Button
              className="btn-bounce bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
            >
              Все задачи решены!
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
