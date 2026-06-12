"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useDailyChallenge } from "@/hooks/use-daily-challenge";
import { DailyChallengeWidget } from "@/components/dashboard/daily-challenge-widget";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { MiniLeaderboard } from "@/components/dashboard/mini-leaderboard";
import { RecentAchievements } from "@/components/dashboard/recent-achievements";
import { WeeklyXpChart } from "@/components/dashboard/weekly-xp-chart";
import { ReferralCard } from "@/components/profile/referral-card";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { StreakCalendar } from "@/components/gamification/streak-calendar";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { AchievementUnlockModal, type AchievementData } from "@/components/gamification/achievement-unlock-modal";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Target, ArrowRight, Zap, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  streak: number;
  level?: number;
  image?: string | null;
  role?: string | null;
  isCurrentUser?: boolean;
}

interface AchievementItem {
  name: string;
  icon: string;
  earnedAt: string;
}

export default function DashboardPage() {
  const { xp, level, streak, name, image, role, completedChallenges, rank } = useUserStore();
  const { data: dailyData, isLoading: dailyLoading } = useDailyChallenge();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [weeklyXp, setWeeklyXp] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [hearts, setHearts] = useState(3);
  const [nextHeartAt, setNextHeartAt] = useState<string | null>(null);

  // Achievement unlock modal state for dashboard
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null);
  const prevAchievementsRef = useRef<AchievementItem[]>([]);

  // Check for newly earned achievements
  useEffect(() => {
    if (achievements.length === 0) return;
    if (prevAchievementsRef.current.length === 0) {
      prevAchievementsRef.current = achievements;
      return;
    }
    const prevNames = new Set(prevAchievementsRef.current.map((a) => a.name));
    const newOnes = achievements.filter((a) => !prevNames.has(a.name));
    if (newOnes.length > 0) {
      const first = newOnes[0];
      setCurrentAchievement({
        name: first.name,
        description: "",
        icon: first.icon,
      });
      setShowAchievementModal(true);
    }
    prevAchievementsRef.current = achievements;
  }, [achievements]);

  useEffect(() => {
    // Fetch leaderboard
    fetch("/api/leaderboard?period=weekly")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLeaderboard(
            data.slice(0, 5).map((e: LeaderboardEntry, i: number) => ({
              ...e,
              rank: i + 1,
            }))
          );
        }
      })
      .catch(() => {});

    // Fetch achievements
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAchievements(
            data
              .filter((a: { earned: boolean }) => a.earned)
              .map((a: { name: string; icon: string; earnedAt: string }) => ({
                name: a.name,
                icon: a.icon,
                earnedAt: a.earnedAt,
              }))
          );
        }
      })
      .catch(() => {});

    // Fetch activity data
    fetch("/api/user/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.weeklyXp) setWeeklyXp(data.weeklyXp);
        if (data.activeDays) setActiveDays(data.activeDays);
        if (typeof data.hearts === "number") setHearts(data.hearts);
        if (data.nextHeartAt) setNextHeartAt(data.nextHeartAt);
      })
      .catch(() => {});
  }, []);

  return (
    <AppLayout>
      <AchievementUnlockModal
        show={showAchievementModal}
        achievement={currentAchievement}
        onClose={() => setShowAchievementModal(false)}
      />
      <div className="mx-auto max-w-7xl space-y-3">
        {/* Welcome Section — compact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AvatarFrame level={level} image={image} name={name} size="md" role={role} />
            <div>
              <h1 className="text-xl font-bold">
                Привет, <span className="gradient-text">{name || "Разработчик"}</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Продолжай обучение — каждый день на шаг ближе к мастерству
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StreakCounter streak={streak} />
            <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
          </div>
        </div>

        {/* XP Progress — compact */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Прогресс уровня</span>
            <span className="text-xs font-medium text-emerald-400">Уровень {level}</span>
          </div>
          <XPBar currentXp={xp} level={level} showLabel={true} />
        </div>

        {/* Quick Actions Row: Challenges + Marathon */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/challenges" className="block">
            <div className="card-hover relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-purple-500/10 p-3 group hover:border-emerald-500/50 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                    Перейти к задачам
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Решай, зарабатывай XP, прокачивай
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-400/60 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/marathon" className="block">
            <div className="card-hover relative overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-amber-500/10 p-3 group hover:border-orange-500/50 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Flame className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-foreground group-hover:text-orange-400 transition-colors">
                    Марафон
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Серия ответов увеличивает множитель
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
              </div>
            </div>
          </Link>
        </div>

        {/* Stats Grid */}
        <StatsGrid
          stats={{
            completedChallenges: completedChallenges || 0,
            totalXp: xp || 0,
            rank: rank || 0,
            level: level || 1,
          }}
        />

        {/* Activity + Streak row — compact */}
        <div className="grid gap-2 md:grid-cols-2">
          <WeeklyXpChart data={weeklyXp} />
          <StreakCalendar streak={streak} activeDays={activeDays} />
        </div>

        {/* Daily Challenge — compact single-line */}
        {!dailyLoading && (
          <DailyChallengeWidget
            challenge={dailyData?.challenge || null}
            completed={dailyData?.completed || false}
          />
        )}
        {dailyLoading && (
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        )}

        {/* Bottom Grid: Leaderboard + Achievements — equal width/height */}
        <div className="grid gap-2 md:grid-cols-2">
          <MiniLeaderboard entries={leaderboard} />
          <RecentAchievements achievements={achievements} />
        </div>

        {/* Referral Widget — compact */}
        <ReferralCard compact />
      </div>
    </AppLayout>
  );
}
