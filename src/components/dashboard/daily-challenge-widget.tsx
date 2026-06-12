"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel } from "@/lib/gamification";
import { Flame, ChevronRight, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DailyChallengeWidgetProps {
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    type: string;
    category: string;
    xpReward: number;
  } | null;
  completed: boolean;
  className?: string;
}

export function DailyChallengeWidget({
  challenge,
  completed,
  className,
}: DailyChallengeWidgetProps) {
  if (!challenge) {
    return (
      <div className={cn("glass rounded-2xl p-6", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold">Ежедневная задача</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          На сегодня задач нет. Возвращайтесь завтра!
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative glass rounded-2xl p-6 transition-all duration-300 overflow-hidden",
        completed ? "border-emerald-500/20" : "border-amber-500/20",
        className
      )}
    >
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-purple-500/5 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-400 fire-pulse" />
            <h3 className="text-lg font-semibold">Ежедневная задача</h3>
          </div>
          {completed && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Выполнено
            </Badge>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{categoryEmoji(challenge.category)}</span>
            <Badge variant="outline" className={difficultyBadgeClass(challenge.difficulty)}>
              {difficultyLabel(challenge.difficulty)}
            </Badge>
            <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10">
              {categoryLabel(challenge.category)}
            </Badge>
          </div>
          <h4 className="text-xl font-bold mb-2">{challenge.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {challenge.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-semibold">+{challenge.xpReward} XP</span>
          </div>

          {!completed && (
            <Link href={`/challenges/${challenge.id}`}>
              <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                Начать
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
