"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useDailyChallenge } from "@/hooks/use-daily-challenge";
import { DailyChallengeWidget } from "@/components/dashboard/daily-challenge-widget";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { MiniLeaderboard } from "@/components/dashboard/mini-leaderboard";
import { SkillProgressList } from "@/components/dashboard/skill-progress-list";
import { RecentAchievements } from "@/components/dashboard/recent-achievements";
import { WeeklyXpChart } from "@/components/dashboard/weekly-xp-chart";
import { LevelBadge } from "@/components/gamification/level-badge";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { StreakCalendar } from "@/components/gamification/streak-calendar";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Target, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  streak: number;
  isCurrentUser?: boolean;
}

interface SkillProgressItem {
  id: string;
  name: string;
  category: string;
  xp: number;
  requiredXp: number;
  level: number;
}

interface AchievementItem {
  name: string;
  icon: string;
  earnedAt: string;
}

export default function DashboardPage() {
  const { xp, level, streak, name, completedChallenges, rank } = useUserStore();
  const { data: dailyData, isLoading: dailyLoading } = useDailyChallenge();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [skills, setSkills] = useState<SkillProgressItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [weeklyXp, setWeeklyXp] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [hearts, setHearts] = useState(3);
  const [nextHeartAt, setNextHeartAt] = useState<string | null>(null);

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

    // Fetch skills
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSkills(data);
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

    // Fetch activity data (weekly XP, active days, hearts)
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
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">
                Привет, <span className="gradient-text">{name || "Разработчик"}</span>! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Продолжай обучение — каждый день на шаг ближе к мастерству
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <LevelBadge level={level} size="lg" />
              <div className="text-right space-y-1">
                <StreakCounter streak={streak} />
                <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
              </div>
            </div>
          </div>

          {/* Mobile: Level + Streak + Hearts row */}
          <div className="flex sm:hidden items-center gap-3 mb-4">
            <LevelBadge level={level} size="md" />
            <StreakCounter streak={streak} />
            <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
          </div>

          {/* XP Progress */}
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Прогресс уровня</span>
              <span className="text-sm font-medium text-emerald-400">Уровень {level}</span>
            </div>
            <XPBar currentXp={xp} level={level} showLabel={true} />
          </div>
        </motion.div>

        {/* 🎯 BIG CTA: Go to Challenges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <Link href="/challenges" className="block">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-purple-500/10 p-5 group hover:border-emerald-500/50 transition-all duration-300">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                    Перейти к задачам
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Решай задачи, зарабатывай опыт, прокачивай навыки
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-emerald-400/60 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <StatsGrid
            stats={{
              completedChallenges: completedChallenges || 0,
              totalXp: xp || 0,
              rank: rank || 0,
              level: level || 1,
            }}
          />
        </motion.div>

        {/* Weekly Activity + Streak Calendar row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid gap-4 md:grid-cols-2"
        >
          <WeeklyXpChart data={weeklyXp} />
          <StreakCalendar streak={streak} activeDays={activeDays} />
        </motion.div>

        {/* Daily Challenge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {!dailyLoading && (
            <DailyChallengeWidget
              challenge={dailyData?.challenge || null}
              completed={dailyData?.completed || false}
            />
          )}
          {dailyLoading && (
            <div className="glass rounded-2xl p-6 shimmer h-48" />
          )}
        </motion.div>

        {/* Bottom Grid: Leaderboard + Skills + Achievements */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <MiniLeaderboard entries={leaderboard} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <SkillProgressList skills={skills} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="md:col-span-2 lg:col-span-1"
          >
            <RecentAchievements achievements={achievements} />
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
