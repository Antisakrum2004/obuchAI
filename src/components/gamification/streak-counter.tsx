"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useIsMobile } from "@/hooks/use-mobile";

interface StreakCounterProps {
  streak: number;
  className?: string;
}

export function StreakCounter({ streak, className }: StreakCounterProps) {
  const { streakFire } = useAppSettings();
  const isMobile = useIsMobile();

  // ★ Updated thresholds: >=3 basic fire, >=7 medium, >=14 intense, >=30 legendary
  const isOnFire = streakFire && streak >= 3;
  const isMedium = streakFire && streak >= 7;
  const isIntense = streakFire && streak >= 14;
  const isLegendary = streakFire && streak >= 30;

  // Fire particles only on desktop, only for streak >= 14
  // Replaced Framer Motion with CSS-only particles for performance
  const showFireParticles = isIntense && !isMobile;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "relative flex items-center gap-1.5 rounded-full px-3 py-1.5",
          // Base styles (no fire)
          !isOnFire && streak > 0 && "bg-amber-500/15 border border-amber-500/20",
          !isOnFire && streak === 0 && "bg-white/5 border border-white/5",
          // Basic fire tier: streak >= 3
          isOnFire && !isMedium && "bg-amber-500/15 border border-amber-500/30",
          // Medium fire tier: streak >= 7
          isMedium && !isIntense && "streak-fire-border bg-amber-500/15",
          // Intense fire tier: streak >= 14
          isIntense && !isLegendary && "streak-fire-border-intense bg-amber-500/20",
          // Legendary tier: streak >= 30
          isLegendary && "streak-fire-border-legendary bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20"
        )}
        style={
          isOnFire && !isMedium
            ? { boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), 0 0 20px rgba(245, 158, 11, 0.08)" }
            : isMedium && !isIntense
            ? { boxShadow: "0 0 15px rgba(245, 158, 11, 0.3), 0 0 30px rgba(245, 158, 11, 0.1)" }
            : isIntense && !isLegendary
            ? { boxShadow: "0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)" }
            : isLegendary
            ? { boxShadow: "0 0 25px rgba(245, 158, 11, 0.5), 0 0 50px rgba(234, 179, 8, 0.3), 0 0 75px rgba(245, 158, 11, 0.1)" }
            : undefined
        }
      >
        {/* CSS-only fire particles (desktop, streak >= 14) */}
        {showFireParticles && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <span className="streak-fire-particle streak-fire-particle-1" />
            <span className="streak-fire-particle streak-fire-particle-2" />
            <span className="streak-fire-particle streak-fire-particle-3" />
          </div>
        )}

        <Flame
          className={cn(
            "relative z-10",
            isOnFire ? "streak-flame-wobble" : "",
            !isOnFire && streak > 0 ? "h-4 w-4 text-amber-400" : "",
            !isOnFire && streak === 0 ? "h-4 w-4 text-muted-foreground" : "",
            isOnFire && !isMedium ? "h-4 w-4 text-amber-400" : "",
            isMedium && !isIntense ? "h-5 w-5 text-amber-400" : "",
            isIntense && !isLegendary ? "h-5 w-5 text-orange-400" : "",
            isLegendary ? "h-6 w-6 text-yellow-300 streak-flame-legendary" : ""
          )}
        />
        <span
          className={cn(
            "relative z-10 text-sm font-bold",
            !isOnFire && streak > 0 && "text-amber-400",
            !isOnFire && streak === 0 && "text-muted-foreground",
            isOnFire && !isLegendary && "text-amber-400",
            isLegendary && "text-yellow-300 streak-text-glow"
          )}
        >
          {streak}
        </span>
      </div>

      {/* LEGENDARY label */}
      {isLegendary && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[8px] font-black tracking-[0.2em] uppercase bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent streak-legendary-label">
            LEGENDARY
          </span>
        </div>
      )}
    </div>
  );
}
