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

function getLiquidColors(tier: string) {
  switch (tier) {
    case "emerald":
      return {
        fill: "linear-gradient(180deg, #34d399 0%, #10b981 40%, #059669 100%)",
        wave: "rgba(52, 211, 153, 0.4)",
        shimmer: "rgba(167, 243, 208, 0.3)",
        bubble: "rgba(167, 243, 208, 0.5)",
      };
    case "blue-purple":
      return {
        fill: "linear-gradient(180deg, #a78bfa 0%, #8b5cf6 40%, #7c3aed 100%)",
        wave: "rgba(167, 139, 250, 0.4)",
        shimmer: "rgba(196, 181, 253, 0.3)",
        bubble: "rgba(196, 181, 253, 0.5)",
      };
    case "amber-gold":
      return {
        fill: "linear-gradient(180deg, #fbbf24 0%, #f59e0b 40%, #d97706 100%)",
        wave: "rgba(251, 191, 36, 0.4)",
        shimmer: "rgba(253, 230, 138, 0.3)",
        bubble: "rgba(253, 230, 138, 0.5)",
      };
    case "rainbow":
      return {
        fill: "linear-gradient(180deg, #f472b6 0%, #a78bfa 30%, #60a5fa 60%, #34d399 100%)",
        wave: "rgba(167, 139, 250, 0.4)",
        shimmer: "rgba(255, 255, 255, 0.3)",
        bubble: "rgba(255, 255, 255, 0.5)",
      };
    default:
      return {
        fill: "linear-gradient(180deg, #34d399 0%, #10b981 100%)",
        wave: "rgba(52, 211, 153, 0.4)",
        shimmer: "rgba(167, 243, 208, 0.3)",
        bubble: "rgba(167, 243, 208, 0.5)",
      };
  }
}

export function XPBar({ currentXp, level, className, showLabel = true, compact = false }: XPBarProps) {
  const { liquidXp } = useAppSettings();
  const isMobile = useIsMobile();
  const { current, required, percentage } = xpProgressInLevel(currentXp);
  const tier = getLevelTier(level);
  const colors = getLiquidColors(tier);
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

  // On mobile OR compact mode, use simple gradient bar (no liquid, no bubbles)
  const useSimpleBar = compact || isMobile;

  // ─── Liquid mode (desktop only, non-compact) ───
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
                {/* Liquid fill */}
                <div
                  className={cn(
                    "xp-liquid-fill absolute bottom-0 left-0 right-0 transition-[height] duration-700 ease-out",
                    pulse && "xp-gain-pulse"
                  )}
                  style={{
                    height: `${pct}%`,
                    background: colors.fill,
                  }}
                >
                  {/* Wave surface */}
                  <div
                    className="xp-wave absolute left-[-25%] right-[-25%] top-[-60%] h-[120%]"
                    style={{
                      borderRadius: "40% 40% 35% 35%",
                      background: colors.wave,
                      animationDuration: "3s",
                    }}
                  />

                  {/* Shimmer highlight */}
                  <div
                    className="xp-shimmer absolute inset-0"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${colors.shimmer} 45%, ${colors.shimmer} 55%, transparent 100%)`,
                    }}
                  />
                </div>

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

  // ─── Standard (non-liquid) mode — beautiful gradient bar ───
  // Also used for mobile (no bubbles, no wave, simple gradient + shimmer)
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
              {/* Gradient fill */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out overflow-hidden",
                  barHeight
                )}
                style={{
                  width: `${pct}%`,
                  background: barGradient,
                }}
              >
                {/* Shimmer streak moving across the fill — skip on mobile */}
                {!isMobile && (
                  <div
                    className="xp-bar-shimmer absolute inset-0"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.25) 55%, transparent 100%)",
                    }}
                  />
                )}
              </div>

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
