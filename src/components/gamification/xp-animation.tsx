"use client";

import { cn } from "@/lib/utils";

interface XPAnimationProps {
  amount: number;
  show: boolean;
  className?: string;
  onComplete?: () => void;
}

export function XPAnimation({ amount, show, className, onComplete }: XPAnimationProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-4 top-0 z-50 xp-float text-lg font-bold text-emerald-400",
        className
      )}
      onAnimationEnd={() => onComplete?.()}
    >
      +{amount} XP
    </div>
  );
}
