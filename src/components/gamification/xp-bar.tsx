"use client";

import { cn } from "@/lib/utils";
import { xpProgressInLevel } from "@/lib/gamification";
import { useEffect, useRef, useState } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
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
  compact?: boolean; // thinner bar for header usage (8px)
}

function getLevelTier(level: number): "emerald" | "blue-purple" | "amber-gold" | "rainbow" {
  if (level <= 5) return "emerald";
  if (level <= 15) return "blue-purple";
  if (level <= 30) return "amber-gold";
  return "rainbow";
}

function getBarGradient(tier: string): string {
  switch (tier) {
    case "emerald":
      return "linear-gradient(90deg, #10b981 0%, #34d399 100%)";
    case "blue-purple":
      return "linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)";
    case "amber-gold":
      return "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)";
    case "rainbow":
      return "linear-gradient(90deg, #f472b6 0%, #a78bfa 33%, #60a5fa 66%, #34d399 100%)";
    default:
      return "linear-gradient(90deg, #10b981 0%, #34d399 100%)";
  }
}

function getTipColor(tier: string): string {
  switch (tier) {
    case "emerald":
      return "#34d399";
    case "blue-purple":
      return "#a78bfa";
    case "amber-gold":
      return "#fbbf24";
    case "rainbow":
      return "#60a5fa";
    default:
      return "#34d399";
  }
}

export function XPBar({ currentXp, level, className, showLabel = true, compact = false }: XPBarProps) {
  const { liquidXp } = useAppSettings();
  const isMobile = useIsMobile();
  const { current, required, percentage } = xpProgressInLevel(currentXp);
  const tier = getLevelTier(level);
  const barGradient = getBarGradient(tier);
  const tipColor = getTipColor(tier);
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

  const barHeight = compact ? "h-2" : "h-3";
  const pct = Math.max(percentage, 0);
  const pctDisplay = Math.round(pct);

  // On mobile OR compact mode, use simple gradient bar (no liquid)
  const useSimpleBar = compact || isMobile;

  // ─── Liquid mode (desktop only, non-compact) — simplified ───
  if (liquidXp && !useSimpleBar) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Level number on left */}
        {!compact && (
          <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">
            {level}
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
              <div className={cn("xp-bar-track w-full overflow-hidden rounded-full bg-white/5 relative", barHeight)}>
                {/* Colored fill — only covers pct% of the track */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
                    pulse && "xp-gain-pulse"
                  )}
                  style={{
                    width: `${pct}%`,
                    background: barGradient,
                  }}
                />

                {/* Glow tip at end of fill */}
                {pct > 2 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out pointer-events-none"
                    style={{ left: `calc(${pct}% - 4px)` }}
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: tipColor,
                        boxShadow: `0 0 6px ${tipColor}, 0 0 12px ${tipColor}40`,
                      }}
                    />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-card border-border text-foreground">
              {current} / {required} XP
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

  // ─── Standard (non-liquid) mode — simple gradient bar ───
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Current level on left */}
      {!compact && (
        <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">
          {level}
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
                "xp-bar-track w-full overflow-visible rounded-full bg-white/5 relative",
                barHeight,
                pulse && "xp-gain-pulse"
              )}
            >
              {/* Gradient fill — only covers pct% of the track */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
                  barHeight
                )}
                style={{
                  width: `${pct}%`,
                  background: barGradient,
                }}
              />

              {/* Glow tip at end of fill */}
              {pct > 2 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out pointer-events-none z-10"
                  style={{ left: `calc(${pct}% - 4px)` }}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: tipColor,
                      boxShadow: `0 0 6px ${tipColor}, 0 0 12px ${tipColor}40`,
                    }}
                  />
                </div>
              )}

              {/* Percentage text inside bar (only when bar is wide enough) */}
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
            {current} / {required} XP
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
