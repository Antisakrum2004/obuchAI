"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HeartsDisplayProps {
  hearts: number;
  maxHearts?: number;
  /** When will the next heart regenerate? ISO date string */
  nextHeartAt?: string | null;
  className?: string;
}

export function HeartsDisplay({ hearts, maxHearts = 3, nextHeartAt, className }: HeartsDisplayProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!nextHeartAt || hearts >= maxHearts) return;

    const update = () => {
      const diff = new Date(nextHeartAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${String(seconds).padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextHeartAt, hearts, maxHearts]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: maxHearts }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={i < hearts ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-colors",
                i < hearts
                  ? "fill-red-500 text-red-500"
                  : "fill-white/5 text-white/20"
              )}
            />
          </motion.div>
        ))}
      </div>
      {timeLeft && (
        <span className="text-[10px] text-red-400/70 font-mono">
          +1 через {timeLeft}
        </span>
      )}
    </div>
  );
}
