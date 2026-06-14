"use client";

import { cn } from "@/lib/utils";
import { xpProgressInLevel, getGradeName, calculateLevel } from "@/lib/gamification";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface XPBarProps {
  currentXp: number;
  level: number;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
  /** Full-width centered mode for header with grade label */
  detailed?: boolean;
}

/**
 * Grade-based bar color matching the spec:
 * 1-4  Начинающий  → emerald-500 (#10b981)
 * 5-9  Специалист  → blue-500    (#3b82f6)
 * 10-14 Мастер     → purple-500  (#a855f7)
 * 15-19 Про        → amber-500   (#f59e0b)
 * 20-24 Звезда     → yellow-400  (#facc15)
 * 25+   Легенда    → rose-500    (#f43f5e)
 */
function getGradeBarColor(level: number): string {
  if (level >= 25) return "#f43f5e"; // rose-500
  if (level >= 20) return "#facc15"; // yellow-400
  if (level >= 15) return "#f59e0b"; // amber-500
  if (level >= 10) return "#a855f7"; // purple-500
  if (level >= 5)  return "#3b82f6"; // blue-500
  return "#10b981";                   // emerald-500
}

/** Background tint matching the grade (used for badge-style backgrounds) */
function getGradeBgClass(level: number): string {
  if (level >= 25) return "bg-rose-500/15 text-rose-400";
  if (level >= 20) return "bg-yellow-500/15 text-yellow-400";
  if (level >= 15) return "bg-amber-500/15 text-amber-400";
  if (level >= 10) return "bg-purple-500/15 text-purple-400";
  if (level >= 5)  return "bg-blue-500/15 text-blue-400";
  return "bg-emerald-500/15 text-emerald-400";
}

export function XPBar({
  currentXp,
  level: _levelProp,
  className,
  showLabel = true,
  compact = false,
  detailed = false,
}: XPBarProps) {
  const isMobile = useIsMobile();
  // Always calculate level from total XP to avoid stale level prop mismatches
  const level = calculateLevel(currentXp);
  const { current, required, percentage } = xpProgressInLevel(currentXp);
  const gradeName = getGradeName(level);
  const barColor = getGradeBarColor(level);
  const prevPercentageRef = useRef(percentage);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (percentage > prevPercentageRef.current) {
      const t1 = setTimeout(() => setPulse(true), 0);
      const t2 = setTimeout(() => setPulse(false), 600);
      prevPercentageRef.current = percentage;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevPercentageRef.current = percentage;
  }, [percentage]);

  const pct = Math.max(percentage, 0);
  const pctDisplay = Math.round(pct);

  // ── Detailed mode: full-width header bar with grade label ──
  if (detailed) {
    return (
      <div className={cn("w-full", className)}>
        {/* Label row: "Уровень {lvl} | {Название грейда} | {xp_current}/{xp_next} XP" */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap",
                getGradeBgClass(level)
              )}
            >
              Уровень {level}
            </span>
            <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">
              {gradeName}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
            {current} / {required} XP
          </span>
        </div>

        {/* Progress track */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "w-full h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10 relative",
                pulse && "xp-gain-pulse"
              )}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-card border-border text-foreground">
            <div className="text-center">
              <div className="font-bold">{current} / {required} XP до след. уровня</div>
              <div className="text-xs text-muted-foreground mt-0.5">Всего: {currentXp} XP</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ── Compact / standard mode (original layout) ──
  const barHeight = compact ? "h-2" : "h-3";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Current level on left */}
      {!compact && (
        <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0 whitespace-nowrap">
          {level} <span className="font-normal text-muted-foreground text-[10px] ml-0.5">{gradeName}</span>
        </span>
      )}

      <div className="flex-1">
        {/* Label row */}
        {showLabel && !compact && (
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {current} / {required} XP
            </span>
            <span className="text-muted-foreground tabular-nums">
              {pctDisplay}%
            </span>
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10 relative",
                barHeight,
                pulse && "xp-gain-pulse"
              )}
            >
              {/* Colored fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
              />

              {/* Percentage text inside bar (only compact + wide enough) */}
              {compact && pct > 15 && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80 tabular-nums pointer-events-none"
                  style={{ width: `${pct}%` }}
                >
                  {pctDisplay}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-card border-border text-foreground">
            <div className="text-center">
              <div className="font-bold">{current} / {required} XP до след. уровня</div>
              <div className="text-xs text-muted-foreground mt-0.5">Всего: {currentXp} XP</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Next level on right */}
      {!compact && (
        <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
          {level + 1}
        </span>
      )}
    </div>
  );
}
