"use client";

import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-xl",
};

function getLevelTier(level: number) {
  if (level >= 31) return { name: "Алмаз", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", glow: "shadow-[0_0_15px_rgba(34,211,238,0.3)]" };
  if (level >= 16) return { name: "Золото", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]" };
  if (level >= 6) return { name: "Серебро", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-400/30", glow: "shadow-[0_0_15px_rgba(148,163,184,0.2)]" };
  return { name: "Бронза", color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "" };
}

export function LevelBadge({ level, className, size = "md" }: LevelBadgeProps) {
  const tier = getLevelTier(level);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border font-bold",
        tier.color,
        tier.bg,
        tier.border,
        tier.glow,
        sizeClasses[size],
        className
      )}
      title={`Уровень ${level} • ${tier.name}`}
    >
      {level}
    </div>
  );
}
