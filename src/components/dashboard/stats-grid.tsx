"use client";

import { cn } from "@/lib/utils";
import { Target, Zap, Trophy, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/gamification/animated-number";

interface StatsGridProps {
  stats: {
    completedChallenges: number;
    totalXp: number;
    rank: number;
    level: number;
  };
  className?: string;
}

const statCards = [
  { key: "completedChallenges", label: "Задач решено", icon: Target, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  { key: "totalXp", label: "Всего XP", icon: Zap, color: "text-amber-400", bgColor: "bg-amber-500/10" },
  { key: "rank", label: "Рейтинг", icon: Trophy, color: "text-purple-400", bgColor: "bg-purple-500/10" },
  { key: "level", label: "Уровень", icon: TrendingUp, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
] as const;

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4", className)}>
      {statCards.map((card) => {
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className="glass rounded-xl p-2.5 transition-all duration-200 hover:bg-white/[0.07]"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", card.bgColor)}>
                <card.icon className={cn("h-3.5 w-3.5", card.color)} />
              </div>
            </div>
            <p className={cn("text-xl font-bold", card.color)}>
              {card.key === "rank" ? (
                <>#{value}</>
              ) : (
                <AnimatedNumber value={value} />
              )}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
