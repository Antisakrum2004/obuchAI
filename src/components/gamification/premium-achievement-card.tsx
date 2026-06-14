"use client";

import { cn } from "@/lib/utils";
import { AchievementIcon, type AchievementIconName } from "@/components/gamification/achievement-icons";

// ★ Rarity system
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

interface PremiumAchievementCardProps {
  name: string;
  description: string;
  icon: string;
  iconName?: AchievementIconName; // SVG icon name — takes priority over emoji icon
  rarity: AchievementRarity;
  xpReward: number;
  earned: boolean;
  earnedAt?: string | null;
  progress?: number; // kept for API compat, but not rendered
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

const rarityTextColor: Record<AchievementRarity, string> = {
  common: "text-slate-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-amber-400",
};

export function PremiumAchievementCard({
  name,
  icon,
  iconName,
  rarity,
  xpReward,
  earned,
  earnedAt,
  className,
}: PremiumAchievementCardProps) {
  const isCompact = className?.includes("compact");

  return (
    <div
      className={cn(
        "relative rounded-lg border transition-all duration-200",
        earned
          ? [rarityBorder[rarity], "bg-gradient-to-b from-white/[0.04] to-white/[0.01]"]
          : ["border-white/[0.06] bg-white/[0.02] opacity-30 grayscale"],
        earned && "hover:-translate-y-1 hover:shadow-lg",
        isCompact ? "p-1.5" : "",
        className
      )}
    >
      {isCompact ? (
        /* ── Compact layout: icon + text inline ── */
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              earned ? rarityTextColor[rarity] : "text-muted-foreground/40"
            )}
            style={{ width: 28, height: 28 }}
          >
            {iconName ? (
              <AchievementIcon
                name={iconName}
                className="w-full h-full"
                color={earned ? undefined : "currentColor"}
              />
            ) : (
              <span className="text-base leading-none">{icon}</span>
            )}
          </div>
          <div className="min-w-0">
            <h4
              className={cn(
                "text-[10px] font-bold truncate leading-tight",
                earned ? "text-foreground" : "text-muted-foreground/40"
              )}
            >
              {name}
            </h4>
            <span
              className={cn(
                "text-[8px] font-semibold",
                earned ? "text-emerald-400" : "text-muted-foreground/30"
              )}
            >
              +{xpReward} XP
            </span>
          </div>
        </div>
      ) : (
        /* ── Default layout: centered icon over text ── */
        <>
          {/* Floating icon — overlaps top edge */}
          <div className="flex justify-center -mt-5 relative z-10">
            <div
              className={cn(
                "flex items-center justify-center",
                earned ? rarityTextColor[rarity] : "text-muted-foreground/40"
              )}
              style={{ width: 44, height: 44 }}
            >
              {iconName ? (
                <AchievementIcon
                  name={iconName}
                  className="w-full h-full"
                  color={earned ? undefined : "currentColor"}
                />
              ) : (
                <span className="text-2xl leading-none">{icon}</span>
              )}
            </div>
          </div>

          {/* Card body */}
          <div className="px-3 pb-3 pt-1 text-center">
            {/* Rarity label */}
            <div className="flex justify-center mb-1">
              <span
                className={cn(
                  "text-[9px] font-bold tracking-wider uppercase",
                  `ach-rarity--${rarity}`
                )}
              >
                {rarityLabel[rarity]}
              </span>
            </div>

            {/* Achievement name */}
            <h4
              className={cn(
                "text-xs font-bold text-center line-clamp-1 mb-1",
                earned ? "text-foreground" : "text-muted-foreground/40"
              )}
            >
              {name}
            </h4>

            {/* XP reward */}
            <span
              className={cn(
                "inline-block text-[10px] font-semibold",
                earned
                  ? "text-emerald-400"
                  : "text-muted-foreground/30"
              )}
            >
              +{xpReward} XP
            </span>

            {/* Earned date */}
            {earned && earnedAt && (
              <p className="text-[8px] text-muted-foreground/30 mt-1">
                {new Date(earnedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
