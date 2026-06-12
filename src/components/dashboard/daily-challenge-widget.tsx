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
      <div className={cn("glass rounded-xl p-3", className)}>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold">Ежедневная задача</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          На сегодня задач нет. Возвращайтесь завтра!
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative glass rounded-xl p-3 transition-all duration-300 overflow-hidden",
        completed ? "border-emerald-500/20" : "border-amber-500/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Left: icon + badges */}
        <div className="flex items-center gap-2 shrink-0">
          <Flame className={cn("h-4 w-4 text-amber-400", !completed && "fire-pulse")} />
          <span className="text-lg">{categoryEmoji(challenge.category)}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", difficultyBadgeClass(challenge.difficulty))}>
            {difficultyLabel(challenge.difficulty)}
          </Badge>
        </div>

        {/* Middle: title + desc */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold truncate">{challenge.title}</h4>
            {completed && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                Готово
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {challenge.description}
          </p>
        </div>

        {/* Right: XP + button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-emerald-400">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">+{challenge.xpReward} XP</span>
          </div>
          {!completed && (
            <Link href={`/challenges/${challenge.id}`}>
              <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-7 text-xs px-3">
                Начать
                <ChevronRight className="ml-0.5 h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
