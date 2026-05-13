"use client";

import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface AchievementCardProps {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  xpReward?: number;
  className?: string;
}

export function AchievementCard({
  name,
  description,
  icon,
  earned,
  xpReward,
  className,
}: AchievementCardProps) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200",
        earned
          ? "border-purple-500/30 bg-purple-500/5 glass-hover"
          : "border-white/5 bg-white/[0.02] opacity-60",
        className
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl",
          earned ? "bg-purple-500/20" : "bg-white/5"
        )}
      >
        {earned ? icon : <Lock className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4
          className={cn(
            "text-sm font-semibold",
            earned ? "gradient-text" : "text-muted-foreground"
          )}
        >
          {name}
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{description}</p>
        {xpReward && xpReward > 0 && earned && (
          <span className="mt-1 inline-block text-xs text-emerald-400">+{xpReward} XP</span>
        )}
      </div>
    </div>
  );
}
