"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LevelUpModalProps {
  show: boolean;
  level: number;
  previousLevel: number;
  xpEarned: number;
  onClose: () => void;
}

// Get tier info based on level
function getLevelTier(level: number) {
  if (level >= 31) return { name: "Алмаз", color: "text-cyan-300", bg: "bg-cyan-500/20", border: "border-cyan-500/30", glow: "shadow-[0_0_40px_rgba(34,211,238,0.4)]" };
  if (level >= 16) return { name: "Золото", color: "text-amber-300", bg: "bg-amber-500/20", border: "border-amber-500/30", glow: "shadow-[0_0_40px_rgba(245,158,11,0.4)]" };
  if (level >= 6) return { name: "Серебро", color: "text-slate-300", bg: "bg-slate-500/20", border: "border-slate-400/30", glow: "shadow-[0_0_40px_rgba(148,163,184,0.3)]" };
  return { name: "Бронза", color: "text-orange-300", bg: "bg-orange-500/20", border: "border-orange-500/30", glow: "shadow-[0_0_40px_rgba(249,115,22,0.3)]" };
}

// Confetti particle component
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const randomX = Math.random() * 100;
  const randomRotate = Math.random() * 360;
  const randomDuration = 1.5 + Math.random() * 1.5;
  
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
      initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
      animate={{
        x: (randomX - 50) * 6,
        y: -100 - Math.random() * 300,
        scale: [0, 1.5, 0],
        rotate: randomRotate + 720,
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: randomDuration,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

export function LevelUpModal({ show, level, previousLevel, xpEarned, onClose }: LevelUpModalProps) {
  const tier = getLevelTier(level);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Determine if it's a tier upgrade
  const prevTier = getLevelTier(previousLevel);
  const isTierUpgrade = tier.name !== prevTier.name;

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  // Auto-close after 5 seconds
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const confettiColors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ef4444", "#ec4899", "#22d3ee"];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Confetti */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={Math.random() * 0.5}
                  color={confettiColors[i % confettiColors.length]}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          <motion.div
            className={cn(
              "relative glass rounded-3xl p-8 max-w-sm w-full mx-4 text-center",
              tier.border,
              tier.glow
            )}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            {/* Tier upgrade banner */}
            {isTierUpgrade && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold border",
                  tier.bg,
                  tier.color,
                  tier.border
                )}
              >
                <Star className="h-3 w-3 inline mr-1" />
                Новая лига: {tier.name}
              </motion.div>
            )}

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2, stiffness: 150 }}
              className={cn(
                "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2",
                tier.bg,
                tier.border
              )}
            >
              <TrendingUp className={cn("h-10 w-10", tier.color)} />
            </motion.div>

            {/* Level number */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.4 }}
            >
              <h2 className="text-2xl font-bold mb-1">Уровень повышен!</h2>
              <div className={cn("text-6xl font-black mt-2 mb-2", tier.color)}>
                {level}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {tier.name} • Уровень {level}
              </p>
            </motion.div>

            {/* XP earned */}
            {xpEarned > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2 text-emerald-400 mb-6"
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-lg font-bold">+{xpEarned} XP</span>
              </motion.div>
            )}

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={onClose}
              className={cn(
                "rounded-xl px-6 py-3 font-semibold transition-all",
                "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                "hover:bg-emerald-500/30"
              )}
            >
              Продолжить
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
