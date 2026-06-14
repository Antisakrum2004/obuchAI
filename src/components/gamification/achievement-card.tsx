"use client";

import { cn } from "@/lib/utils";

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
          : "border-dashed border-white/10 bg-white/[0.02] hover:shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:border-purple-500/20",
        className
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl",
          earned ? "bg-purple-500/20" : "bg-white/5"
        )}
      >
        <span
          className={cn(
            earned ? "" : "grayscale opacity-30"
          )}
          style={!earned ? { filter: "grayscale(100%) opacity(0.3)" } : undefined}
        >
          {icon}
        </span>

        {/* Lock badge overlay for unearned */}
        {!earned && (
          <span
            className="absolute -top-1.5 -right-1.5 text-[10px] leading-none select-none"
            aria-label="Locked"
          >
            🔒
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4
          className={cn(
            "text-sm font-semibold",
            earned ? "gradient-text" : "text-muted-foreground/40"
          )}
        >
          {name}
        </h4>
        <p
          className={cn(
            "mt-0.5 text-xs line-clamp-2",
            earned ? "text-muted-foreground" : "text-muted-foreground/30"
          )}
        >
          {description}
        </p>
        {xpReward && xpReward > 0 && earned && (
          <span className="mt-1 inline-block text-xs text-emerald-400">+{xpReward} XP</span>
        )}
      </div>
    </div>
  );
}
