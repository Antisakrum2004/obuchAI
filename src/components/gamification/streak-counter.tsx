"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  streak: number;
  className?: string;
}

export function StreakCounter({ streak, className }: StreakCounterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5",
        streak > 0
          ? "bg-amber-500/15 border border-amber-500/20"
          : "bg-white/5 border border-white/5",
        className
      )}
    >
      <Flame
        className={cn(
          "h-4 w-4",
          streak > 0 ? "text-amber-400 fire-pulse" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "text-sm font-bold",
          streak > 0 ? "text-amber-400" : "text-muted-foreground"
        )}
      >
        {streak}
      </span>
    </div>
  );
}
