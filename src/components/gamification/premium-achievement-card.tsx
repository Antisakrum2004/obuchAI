"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

// ★ Rarity system
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

interface PremiumAchievementCardProps {
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  xpReward: number;
  earned: boolean;
  earnedAt?: string | null;
  progress?: number; // 0-1 for partial progress
  className?: string;
}

const rarityLabel: Record<AchievementRarity, string> = {
  common: "Обычное",
  rare: "Редкое",
  epic: "Эпическое",
  legendary: "Легендарное",
};

const rarityBorder: Record<AchievementRarity, string> = {
  common: "border-slate-400/20",
  rare: "border-blue-500/30",
  epic: "border-purple-500/30",
  legendary: "border-amber-400/40",
};

const rarityIconBg: Record<AchievementRarity, string> = {
  common: "bg-slate-500/15",
  rare: "bg-blue-500/15",
  epic: "bg-purple-500/15",
  legendary: "bg-amber-500/15",
};

const rarityRingStroke: Record<AchievementRarity, string> = {
  common: "#94a3b8",
  rare: "#3b82f6",
  epic: "#8b5cf6",
  legendary: "#FFB800",
};

export function PremiumAchievementCard({
  name,
  description,
  icon,
  rarity,
  xpReward,
  earned,
  earnedAt,
  progress = 0,
  className,
}: PremiumAchievementCardProps) {
  const isLegendary = rarity === "legendary" && earned;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      className={cn(
        "relative rounded-3xl border backdrop-blur-sm",
        earned
          ? [
              "ach-card--unlocked",
              `ach-glow--${rarity}`,
              rarityBorder[rarity],
              isLegendary && "ach-legendary-border",
              "bg-gradient-to-b from-white/[0.04] to-white/[0.01]",
            ]
          : [
              "ach-card--locked",
              "border-white/[0.06] bg-white/[0.02]",
            ],
        className
      )}
      style={{ padding: 0 }}
    >
      <div className="relative p-5 z-[1]">
        {/* Icon + Progress ring */}
        <div className="relative mx-auto mb-4 flex items-center justify-center" style={{ width: 72, height: 72 }}>
          {/* Progress ring (SVG circle) */}
          {earned ? (
            <svg
              className="ach-progress-ring absolute inset-0"
              width={72}
              height={72}
              viewBox="0 0 72 72"
            >
              {/* Background circle */}
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke={earned ? rarityRingStroke[rarity] : "rgba(255,255,255,0.06)"}
                strokeWidth="2.5"
                strokeOpacity={0.2}
              />
              {/* Full circle for earned */}
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke={rarityRingStroke[rarity]}
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${rarityRingStroke[rarity]}40)` }}
              />
            </svg>
          ) : (
            <svg
              className="ach-progress-ring absolute inset-0"
              width={72}
              height={72}
              viewBox="0 0 72 72"
            >
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="2.5"
              />
              {/* Partial progress ring */}
              {progress > 0 && (
                <circle
                  cx="36"
                  cy="36"
                  r="32"
                  fill="none"
                  stroke={rarityRingStroke[rarity]}
                  strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress)}`}
                  strokeLinecap="round"
                  opacity={0.5}
                />
              )}
            </svg>
          )}

          {/* Icon container */}
          <div
            className={cn(
              "relative flex items-center justify-center rounded-2xl text-3xl",
              earned ? rarityIconBg[rarity] : "bg-white/5"
            )}
            style={{ width: 52, height: 52 }}
          >
            <span className={cn(!earned && "opacity-30")} style={!earned ? { filter: "grayscale(100%)" } : undefined}>
              {icon}
            </span>

            {/* Lock overlay for unearned */}
            {!earned && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]"
                style={{ animation: "lock-bob 2.5s ease-in-out infinite" }}
              >
                <Lock className="h-4 w-4 text-white/40" />
              </div>
            )}
          </div>

          {/* Floating particles for legendary earned */}
          {isLegendary && (
            <>
              <span
                className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400/60"
                style={{ animation: "achievement-float 2s ease-in-out infinite" }}
              />
              <span
                className="absolute bottom-1 left-0 w-1 h-1 rounded-full bg-amber-300/50"
                style={{ animation: "achievement-float 2.5s ease-in-out infinite 0.5s" }}
              />
              <span
                className="absolute top-2 left-1 w-1 h-1 rounded-full bg-yellow-400/40"
                style={{ animation: "achievement-float 3s ease-in-out infinite 1s" }}
              />
            </>
          )}
        </div>

        {/* Rarity badge */}
        <div className="flex justify-center mb-2">
          <span
            className={cn(
              "text-[10px] font-bold tracking-wider uppercase",
              `ach-rarity--${rarity}`
            )}
          >
            {rarityLabel[rarity]}
          </span>
        </div>

        {/* Title */}
        <h4
          className={cn(
            "text-sm font-bold text-center mb-1 line-clamp-1",
            earned ? "text-foreground" : "text-muted-foreground/40"
          )}
        >
          {name}
        </h4>

        {/* Description */}
        <p
          className={cn(
            "text-[11px] text-center line-clamp-2 mb-3",
            earned ? "text-muted-foreground" : "text-muted-foreground/30"
          )}
        >
          {description}
        </p>

        {/* XP reward */}
        <div className="flex justify-center">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full",
              earned
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-white/[0.03] text-muted-foreground/30 border border-white/[0.04]"
            )}
          >
            +{xpReward} XP
          </span>
        </div>

        {/* Earned date */}
        {earned && earnedAt && (
          <p className="text-[9px] text-muted-foreground/40 text-center mt-2">
            {new Date(earnedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>
    </motion.div>
  );
}
