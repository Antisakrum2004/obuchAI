"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAppSettings } from "@/hooks/use-app-settings";

interface StreakCounterProps {
  streak: number;
  className?: string;
}

/** Fire particles that float up behind the counter (streak >= 14) */
function FireParticles() {
  const particles = [
    { left: "15%", size: 4, delay: 0, duration: 1.8 },
    { left: "40%", size: 3, delay: 0.4, duration: 2.0 },
    { left: "60%", size: 5, delay: 0.8, duration: 1.6 },
    { left: "80%", size: 3, delay: 1.2, duration: 2.2 },
    { left: "30%", size: 4, delay: 1.6, duration: 1.9 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.left,
            bottom: "-2px",
            width: p.size,
            height: p.size,
            background: i % 2 === 0 ? "#f59e0b" : "#ef4444",
          }}
          animate={{
            y: [0, -20, -35],
            opacity: [0.8, 0.5, 0],
            scale: [1, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export function StreakCounter({ streak, className }: StreakCounterProps) {
  const { streakFire } = useAppSettings();
  const isOnFire = streakFire && streak >= 7;
  const isIntense = streakFire && streak >= 14;
  const isLegendary = streakFire && streak >= 30;

  return (
    <motion.div
      className={cn("relative", className)}
      initial={isOnFire ? { scale: 0.8, opacity: 0 } : false}
      animate={isOnFire ? { scale: 1, opacity: 1 } : false}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <div
        className={cn(
          "relative flex items-center gap-1.5 rounded-full px-3 py-1.5",
          // Base styles
          !isOnFire && streak > 0 && "bg-amber-500/15 border border-amber-500/20",
          !isOnFire && streak === 0 && "bg-white/5 border border-white/5",
          // Fire tier: streak >= 7
          isOnFire && !isIntense && "streak-fire-border bg-amber-500/15",
          // Intense tier: streak >= 14
          isIntense && !isLegendary && "streak-fire-border-intense bg-amber-500/20",
          // Legendary tier: streak >= 30
          isLegendary && "streak-fire-border-legendary bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20"
        )}
        style={
          isOnFire && !isIntense
            ? { boxShadow: "0 0 15px rgba(245, 158, 11, 0.3), 0 0 30px rgba(245, 158, 11, 0.1)" }
            : isIntense && !isLegendary
            ? { boxShadow: "0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)" }
            : isLegendary
            ? { boxShadow: "0 0 25px rgba(245, 158, 11, 0.5), 0 0 50px rgba(234, 179, 8, 0.3), 0 0 75px rgba(245, 158, 11, 0.1)" }
            : undefined
        }
      >
        {/* Fire particles (streak >= 14) */}
        {isIntense && <FireParticles />}

        <Flame
          className={cn(
            "relative z-10",
            isOnFire ? "streak-flame-wobble" : "",
            !isOnFire && streak > 0 ? "h-4 w-4 text-amber-400" : "",
            !isOnFire && streak === 0 ? "h-4 w-4 text-muted-foreground" : "",
            isOnFire && !isIntense ? "h-5 w-5 text-amber-400" : "",
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
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          <span className="text-[8px] font-black tracking-[0.2em] uppercase bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent streak-legendary-label">
            LEGENDARY
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
