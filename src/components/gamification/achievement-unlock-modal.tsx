"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useAppSettings } from "@/hooks/use-app-settings";

export interface AchievementData {
  name: string;
  description: string;
  icon: string;
  xpReward?: number;
  slug?: string;
}

interface AchievementUnlockModalProps {
  show: boolean;
  achievement: AchievementData | null;
  onClose: () => void;
}

function fireConfettiBurst() {
  // Gold/purple/emerald radial burst
  const colors = ["#f59e0b", "#8b5cf6", "#10b981", "#fbbf24", "#a78bfa", "#34d399"];

  // First burst: center radial
  confetti({
    particleCount: 60,
    spread: 100,
    startVelocity: 30,
    origin: { x: 0.5, y: 0.5 },
    colors,
    ticks: 200,
    gravity: 0.8,
    scalar: 1.2,
    shapes: ["circle", "square"],
  });

  // Second burst: left side
  setTimeout(() => {
    confetti({
      particleCount: 25,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
  }, 150);

  // Third burst: right side
  setTimeout(() => {
    confetti({
      particleCount: 25,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });
  }, 250);
}

export function AchievementUnlockModal({ show, achievement, onClose }: AchievementUnlockModalProps) {
  const { confetti: confettiEnabled } = useAppSettings();
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Fire confetti when modal appears
  useEffect(() => {
    if (show && achievement && confettiEnabled) {
      // Small delay so the modal animation starts first
      const timer = setTimeout(() => {
        fireConfettiBurst();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [show, achievement, confettiEnabled]);

  // Auto-close after 4 seconds
  useEffect(() => {
    if (show) {
      const timer = setTimeout(handleClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, handleClose]);

  return (
    <AnimatePresence>
      {show && achievement && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop - dark with blur */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Achievement Card */}
          <motion.div
            className="relative z-10 max-w-sm w-full mx-4"
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              mass: 0.8,
            }}
          >
            <div className="relative rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-500/10 via-card to-card p-8 text-center overflow-hidden">
              {/* Background glow ring */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
              </div>

              {/* Sparkle accent top-left */}
              <motion.div
                className="absolute top-4 left-4 text-purple-400/40"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>

              {/* Sparkle accent bottom-right */}
              <motion.div
                className="absolute bottom-4 right-4 text-emerald-400/40"
                initial={{ scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>

              {/* "Achievement Unlocked" label */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative mb-4"
              >
                <span className="text-xs font-semibold tracking-widest uppercase text-purple-400/80">
                  Achievement Unlocked
                </span>
              </motion.div>

              {/* Achievement Icon - large, 80px, with pulsing glow */}
              <motion.div
                className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/30"
                initial={{ scale: 0, rotate: -180 }}
                animate={{
                  scale: 1,
                  rotate: 0,
                }}
                transition={{
                  type: "spring",
                  delay: 0.3,
                  stiffness: 150,
                  damping: 12,
                }}
              >
                {/* Pulsing glow effect behind icon */}
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-purple-500/30"
                  animate={{
                    boxShadow: [
                      "0 0 10px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.1)",
                      "0 0 25px rgba(139, 92, 246, 0.5), 0 0 50px rgba(139, 92, 246, 0.2)",
                      "0 0 10px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.1)",
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <span className="relative text-4xl select-none">{achievement.icon}</span>
              </motion.div>

              {/* Achievement Name - gradient text */}
              <motion.h2
                className="relative text-xl font-bold mb-2 gradient-text-gold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {achievement.name}
              </motion.h2>

              {/* Achievement Description */}
              <motion.p
                className="relative text-sm text-muted-foreground mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {achievement.description}
              </motion.p>

              {/* XP Reward */}
              {achievement.xpReward && achievement.xpReward > 0 && (
                <motion.div
                  className="relative flex items-center justify-center gap-2 text-emerald-400 mb-5"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-lg font-bold">+{achievement.xpReward} XP</span>
                </motion.div>
              )}

              {/* Close button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={handleClose}
                className={cn(
                  "relative rounded-xl px-6 py-2.5 font-semibold text-sm transition-all",
                  "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                  "hover:bg-purple-500/30"
                )}
              >
                Continue
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
