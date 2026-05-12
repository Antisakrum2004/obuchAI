"use client";

import { cn } from "@/lib/utils";
import { xpProgressInLevel } from "@/lib/gamification";

interface XPBarProps {
  currentXp: number;
  level: number;
  className?: string;
  showLabel?: boolean;
}

export function XPBar({ currentXp, level, className, showLabel = true }: XPBarProps) {
  const { current, required, percentage } = xpProgressInLevel(currentXp);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1">
        {showLabel && (
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {current} / {required} XP
            </span>
          </div>
        )}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full progress-gradient transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
