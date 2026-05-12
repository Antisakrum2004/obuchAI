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

export function LevelBadge({ level, className, size = "md" }: LevelBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400",
        sizeClasses[size],
        className
      )}
    >
      {level}
    </div>
  );
}
