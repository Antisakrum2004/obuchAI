"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useAppSettings } from "@/hooks/use-app-settings";
import { AchievementIcon, type AchievementIconName } from "@/components/gamification/achievement-icons";

// Icon mapping for unlock modal
const ACHIEVEMENT_ICONS_MAP: Record<string, AchievementIconName> = {
  "first-lesson": "CardReturn",
  "7-day-streak": "Flame",
  "night-learner": "Launch",
  "ai-master": "SwordStrike",
  "deep-focus": "Shield",
  "speed-runner": "Rush",
  "100-tasks-done": "Reward",
  "knowledge-beast": "Strength",
  "no-skip-week": "Recycle",
  "legendary-student": "FireArrow",
  "ice-cold": "IceCard",
  "grab-it": "GrabCard",
  "mystery-solver": "Mystery",
  "silenced": "Silenced",
  "repaint": "Repaint",
  "check-plus": "CheckPlus",
  "one-life": "OneLife",
  "double-xp": "TwoMult",
  "penalty": "MinusOne",
  "bonus": "PlusOne",
};

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
  const colors = ["#f59e0b", "#8b5cf6", "#10b981", "#fbbf24", "#a78bfa", "#34d399"];

  confetti({
    particleCount: 40,
    spread: 80,
    startVelocity: 25,
    origin: { x: 0.5, y: 0.5 },
    colors,
    ticks: 200,
    gravity: 0.8,
    scalar: 1.1,
    shapes: ["circle", "square"],
  });

  setTimeout(() => {
    confetti({
      particleCount: 15,
      angle: 60,
      spread: 45,
      origin: { x: 0, y: 0.6 },
      colors,
    });
  }, 150);

  setTimeout(() => {
    confetti({
      particleCount: 15,
      angle: 120,
      spread: 45,
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

  useEffect(() => {
    if (show && achievement && confettiEnabled) {
      const timer = setTimeout(() => {
        fireConfettiBurst();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [show, achievement, confettiEnabled]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(handleClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, handleClose]);

  const slugKey = achievement?.slug?.toLowerCase().replace(/_/g, "-") || "";
  const iconName: AchievementIconName | undefined = ACHIEVEMENT_ICONS_MAP[slugKey];

  return (
    <AnimatePresence>
      {show && achievement && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Card */}
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
            <div className="relative rounded-lg border border-purple-500/30 bg-gradient-to-b from-purple-500/10 via-card to-card p-6 text-center">

              {/* "Achievement Unlocked" label */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative mb-4"
              >
                <span className="text-xs font-semibold tracking-widest uppercase text-purple-400/80">
                  Достижение разблокировано
                </span>
              </motion.div>

              {/* Achievement Icon — SVG or emoji */}
              <motion.div
                className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center text-purple-400"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  delay: 0.3,
                  stiffness: 150,
                  damping: 12,
                }}
              >
                {iconName ? (
                  <AchievementIcon name={iconName} className="w-full h-full" />
                ) : (
                  <span className="text-4xl select-none">{achievement.icon}</span>
                )}
              </motion.div>

              {/* Achievement Name */}
              <motion.h2
                className="relative text-lg font-bold mb-2 gradient-text-gold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {achievement.name}
              </motion.h2>

              {/* Description */}
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
                  className="relative flex items-center justify-center gap-2 text-emerald-400 mb-4"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                >
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
                  "relative rounded-lg px-5 py-2 font-semibold text-sm transition-all",
                  "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                  "hover:bg-purple-500/30"
                )}
              >
                Продолжить
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
