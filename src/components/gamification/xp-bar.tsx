"use client";

import { cn } from "@/lib/utils";
import { xpProgressInLevel } from "@/lib/gamification";
import { useEffect, useRef, useState } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";

interface XPBarProps {
  currentXp: number;
  level: number;
  className?: string;
  showLabel?: boolean;
}

function getLevelTier(level: number): "emerald" | "blue-purple" | "amber-gold" | "rainbow" {
  if (level <= 5) return "emerald";
  if (level <= 15) return "blue-purple";
  if (level <= 30) return "amber-gold";
  return "rainbow";
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

function Bubble({ color, delay, left }: { color: string; delay: number; left: string }) {
  return (
    <span
      className="xp-bubble absolute rounded-full"
      style={{
        background: color,
        width: "4px",
        height: "4px",
        left,
        bottom: "10%",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

export function XPBar({ currentXp, level, className, showLabel = true }: XPBarProps) {
  const { liquidXp } = useAppSettings();
  const { current, required, percentage } = xpProgressInLevel(currentXp);
  const tier = getLevelTier(level);
  const colors = getLiquidColors(tier);
  const prevPercentageRef = useRef(percentage);
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    if (percentage > prevPercentageRef.current) {
      // Defer to avoid synchronous setState in effect
      const t1 = setTimeout(() => setSplash(true), 0);
      const t2 = setTimeout(() => setSplash(false), 800);
      prevPercentageRef.current = percentage;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevPercentageRef.current = percentage;
  }, [percentage]);

  // Simple bar mode when liquid XP is disabled
  if (!liquidXp) {
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
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/5 relative">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max(percentage, 0)}%`,
                background: colors.fill,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

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
        <div className="xp-bar-track h-3 w-full overflow-hidden rounded-full bg-white/5 relative">
          {/* Liquid fill */}
          <div
            className={cn(
              "xp-liquid-fill absolute bottom-0 left-0 right-0 transition-[height] duration-700 ease-out",
              splash && "xp-liquid-splash"
            )}
            style={{
              height: `${Math.max(percentage, 0)}%`,
              background: colors.fill,
            }}
          >
            {/* Wave surface - rotating blob for liquid sloshing effect */}
            <div
              className="xp-wave absolute left-[-25%] right-[-25%] top-[-60%] h-[120%]"
              style={{
                borderRadius: "40% 40% 35% 35%",
                background: colors.wave,
                animationDuration: "3s",
              }}
            />

            {/* Shimmer highlight that moves across */}
            <div
              className="xp-shimmer absolute inset-0"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${colors.shimmer} 45%, ${colors.shimmer} 55%, transparent 100%)`,
              }}
            />
          </div>

          {/* Bubbles */}
          {percentage > 5 && (
            <>
              <Bubble color={colors.bubble} delay={0} left="20%" />
              <Bubble color={colors.bubble} delay={2.5} left="65%" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
