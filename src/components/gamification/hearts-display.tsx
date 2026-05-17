"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useAppSettings } from "@/hooks/use-app-settings";

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
      style={{ filter: "drop-shadow(0 0 2px rgba(239, 68, 68, 0.4))" }}
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
      {/* Progress ring */}
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
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

export function HeartsDisplay({ hearts, maxHearts = 3, nextHeartAt, className }: HeartsDisplayProps) {
  const { heartAnimations } = useAppSettings();
  // Animation tracking: which hearts are currently animating and their type
  const [animatingIndices, setAnimatingIndices] = useState<Map<number, "lost" | "restored">>(new Map());
  const prevHeartsRef = useRef(hearts);

  // Timer and regeneration progress
  const [timeLeft, setTimeLeft] = useState("");
  const [regenerationProgress, setRegenerationProgress] = useState(0);

  // Track heart changes via effect — use setTimeout to avoid synchronous setState
  useEffect(() => {
    if (!heartAnimations) return;
    const prev = prevHeartsRef.current;
    if (hearts === prev) return;

    const diff = hearts - prev;
    prevHeartsRef.current = hearts;

    if (diff < 0) {
      // Heart lost — animate the heart at the lost index
      const lostIndex = hearts; // The heart at index `hearts` was just lost
      const timer1 = setTimeout(() => {
        setAnimatingIndices((prev) => {
          const next = new Map(prev);
          next.set(lostIndex, "lost");
          return next;
        });
      }, 0);
      const timer2 = setTimeout(() => {
        setAnimatingIndices((prev) => {
          const next = new Map(prev);
          next.delete(lostIndex);
          return next;
        });
      }, 700);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (diff > 0) {
      // Heart restored — animate the restored heart
      const restoredIndex = hearts - 1;
      const timer1 = setTimeout(() => {
        setAnimatingIndices((prev) => {
          const next = new Map(prev);
          next.set(restoredIndex, "restored");
          return next;
        });
      }, 0);
      const timer2 = setTimeout(() => {
        setAnimatingIndices((prev) => {
          const next = new Map(prev);
          next.delete(restoredIndex);
          return next;
        });
      }, 700);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [hearts]);

  // Timer and regeneration progress
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
    const interval = setInterval(update, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [nextHeartAt, hearts, maxHearts]);

  // Find the first empty heart slot (for regeneration ring)
  const regeneratingHeartIndex = hearts < maxHearts ? hearts : -1;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: maxHearts }).map((_, i) => {
          const isActive = i < hearts;
          const isRegenerating = i === regeneratingHeartIndex;
          const animType = animatingIndices.get(i);
          const isLost = animType === "lost";
          const isRestored = animType === "restored";

          return (
            <motion.div
              key={i}
              className="relative"
              initial={false}
              animate={
                !heartAnimations ? { scale: 1, opacity: isActive ? 1 : 0.15 } :
                isLost
                  ? { scale: [1, 1.3, 0.8, 1, 0.5], opacity: [1, 1, 0.5, 0.3, 0.15] }
                  : isRestored
                  ? { scale: [0, 1.3, 1], opacity: [0, 1, 1] }
                  : isActive
                  ? { scale: [1, 1.05, 1] }
                  : { scale: 1, opacity: 0.15 }
              }
              transition={
                isLost
                  ? { duration: 0.6, ease: "easeOut" }
                  : isRestored
                  ? { duration: 0.5, ease: "easeOut" }
                  : isActive
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            >
              {/* Glow effect for lost heart (red flash) */}
              {heartAnimations && isLost && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-red-500"
                  initial={{ opacity: 0.8, scale: 1.5 }}
                  animate={{ opacity: 0, scale: 2 }}
                  transition={{ duration: 0.4 }}
                />
              )}

              {/* Pink glow for restored heart */}
              {heartAnimations && isRestored && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: "0 0 12px rgba(236, 72, 153, 0.6)" }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                />
              )}

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
            </motion.div>
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
