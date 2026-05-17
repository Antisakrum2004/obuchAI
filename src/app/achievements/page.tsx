"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PremiumAchievementCard, type AchievementRarity } from "@/components/gamification/premium-achievement-card";
import { type AchievementIconName } from "@/components/gamification/achievement-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Award, Sparkles, Filter } from "lucide-react";

// ★ Rarity mapping from achievement slug/category
const ACHIEVEMENT_RARITIES: Record<string, AchievementRarity> = {
  "first-lesson": "common",
  "7-day-streak": "rare",
  "night-learner": "rare",
  "ai-master": "epic",
  "deep-focus": "epic",
  "speed-runner": "rare",
  "100-tasks-done": "legendary",
  "knowledge-beast": "epic",
  "no-skip-week": "rare",
  "legendary-student": "legendary",
};

// ★ SVG icon mapping from achievement slug to icon name
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

// Map XP reward ranges to rarity if slug not found
function getRarity(slug: string, xpReward: number): AchievementRarity {
  const slugKey = slug?.toLowerCase().replace(/_/g, "-") || "";
  if (ACHIEVEMENT_RARITIES[slugKey]) return ACHIEVEMENT_RARITIES[slugKey];
  if (xpReward >= 1000) return "legendary";
  if (xpReward >= 500) return "epic";
  if (xpReward >= 150) return "rare";
  return "common";
}

interface AchievementData {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

type FilterType = "all" | "unlocked" | "locked" | "common" | "rare" | "epic" | "legendary";

const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "unlocked", label: "Открытые" },
  { value: "locked", label: "Закрытые" },
  { value: "legendary", label: "Легендарные" },
  { value: "epic", label: "Эпические" },
  { value: "rare", label: "Редкие" },
  { value: "common", label: "Обычные" },
];

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAchievements(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute stats
  const earned = achievements.filter((a) => a.earned);
  const totalXp = earned.reduce((sum, a) => sum + a.xpReward, 0);
  const earnedCount = earned.length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Apply filter
  const filtered = achievements.filter((a) => {
    const rarity = getRarity(a.slug, a.xpReward);
    switch (filter) {
      case "unlocked": return a.earned;
      case "locked": return !a.earned;
      case "common": return rarity === "common";
      case "rare": return rarity === "rare";
      case "epic": return rarity === "epic";
      case "legendary": return rarity === "legendary";
      default: return true;
    }
  });

  // Sort: earned first (by earnedAt desc), then by rarity (legendary first), then by xpReward desc
  const rarityOrder: Record<AchievementRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const ra = getRarity(a.slug, a.xpReward);
    const rb = getRarity(b.slug, b.xpReward);
    if (rarityOrder[ra] !== rarityOrder[rb]) return rarityOrder[ra] - rarityOrder[rb];
    return b.xpReward - a.xpReward;
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
              <Award className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Достижения</h1>
              <p className="text-sm text-muted-foreground">
                Собирай ачивки, прокачивай навыки
              </p>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Progress circle */}
            <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
              <svg className="ach-progress-ring" width={64} height={64} viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke="url(#progressGrad)"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercent / 100)}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#00D4FF" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute text-sm font-bold text-foreground">
                {progressPercent}%
              </span>
            </div>

            {/* Stats */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-lg font-bold gradient-text">
                  {earnedCount} / {totalCount}
                </span>
                <span className="text-sm text-muted-foreground">открыто</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Получено <span className="text-emerald-400 font-semibold">{totalXp.toLocaleString()} XP</span> из достижений
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full sm:w-48">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #7C3AED, #00D4FF)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                filter === opt.value
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                  : "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:bg-white/[0.06] hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Achievements grid — denser with smaller cards */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="glass rounded-lg p-3 pt-7">
                <Skeleton className="h-2 w-10 mx-auto mb-2" />
                <Skeleton className="h-3 w-16 mx-auto mb-1" />
                <Skeleton className="h-2 w-10 mx-auto" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              {filter === "all" ? "Достижений пока нет" : "Ничего не найдено"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sorted.map((achievement) => (
              <PremiumAchievementCard
                key={achievement.id}
                name={achievement.name}
                description={achievement.description}
                icon={achievement.icon}
                iconName={ACHIEVEMENT_ICONS_MAP[achievement.slug?.toLowerCase().replace(/_/g, "-") || ""]}
                rarity={getRarity(achievement.slug, achievement.xpReward)}
                xpReward={achievement.xpReward}
                earned={achievement.earned}
                earnedAt={achievement.earnedAt}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
