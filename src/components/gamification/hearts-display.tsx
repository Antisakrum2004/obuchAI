"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeartsDisplayProps {
  hearts: number;
  maxHearts?: number;
  /** When will the next heart regenerate? ISO date string */
  nextHeartAt?: string | null;
  className?: string;
}

/** Circular progress ring for heart regeneration */
function RegenerationRing({ progress, size = 20 }: { progress: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -rotate-90"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring — CSS transition instead of JS animation */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#ef4444"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-[5000ms] ease-linear"
      />
    </svg>
  );
}

export function HeartsDisplay({ hearts, maxHearts = 3, nextHeartAt, className }: HeartsDisplayProps) {
  const { heartAnimations } = useAppSettings();
  const isMobile = useIsMobile();

  // Timer and regeneration progress
  const [timeLeft, setTimeLeft] = useState("");
  const [regenerationProgress, setRegenerationProgress] = useState(0);

  // Timer and regeneration progress — update every 5s on mobile, every 1s on desktop
  useEffect(() => {
    if (!nextHeartAt || hearts >= maxHearts) {
      return;
    }

    const regenDuration = 30 * 60 * 1000;
    let mounted = true;

    const update = () => {
      if (!mounted) return;
      const targetTime = new Date(nextHeartAt).getTime();
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        setRegenerationProgress(1);
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${String(seconds).padStart(2, "0")}`);
      const elapsed = regenDuration - diff;
      const progress = Math.min(Math.max(elapsed / regenDuration, 0), 1);
      setRegenerationProgress(progress);
    };

    update();
    // Mobile: 5s interval (less re-renders), Desktop: 1s
    const interval = setInterval(update, isMobile ? 5000 : 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [nextHeartAt, hearts, maxHearts, isMobile]);

  // Find the first empty heart slot (for regeneration ring)
  const regeneratingHeartIndex = hearts < maxHearts ? hearts : -1;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: maxHearts }).map((_, i) => {
          const isActive = i < hearts;
          const isRegenerating = i === regeneratingHeartIndex;

          return (
            <div key={i} className="relative">
              {/* Regeneration ring */}
              {heartAnimations && isRegenerating && regenerationProgress > 0 && (
                <RegenerationRing progress={regenerationProgress} size={20} />
              )}

              <Heart
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive
                    ? "fill-red-500 text-red-500"
                    : isRegenerating
                    ? "fill-red-500/20 text-red-500/40"
                    : "fill-white/5 text-white/20"
                )}
              />
            </div>
          );
        })}
      </div>
      {timeLeft && (
        <span className="text-[10px] text-red-400/70 font-mono">
          +1 через {timeLeft}
        </span>
      )}
    </div>
  );
}
