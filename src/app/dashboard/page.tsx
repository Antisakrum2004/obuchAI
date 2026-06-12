"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useDailyChallenge } from "@/hooks/use-daily-challenge";
import { DailyChallengeWidget } from "@/components/dashboard/daily-challenge-widget";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { MiniLeaderboard } from "@/components/dashboard/mini-leaderboard";
import { RecentAchievements } from "@/components/dashboard/recent-achievements";
import { WeeklyXpChart } from "@/components/dashboard/weekly-xp-chart";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { StreakCalendar } from "@/components/gamification/streak-calendar";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { AchievementUnlockModal, type AchievementData } from "@/components/gamification/achievement-unlock-modal";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Target, ArrowRight, Flame, BookOpen } from "lucide-react";
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

interface NextLessonData {
  pathUrl: string;
  space?: { name: string };
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
  const [nextLesson, setNextLesson] = useState<NextLessonData | null>(null);

  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null);
  const prevAchievementsRef = useRef<AchievementItem[]>([]);

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
      setCurrentAchievement({ name: first.name, description: "", icon: first.icon });
      setShowAchievementModal(true);
    }
    prevAchievementsRef.current = achievements;
  }, [achievements]);

  useEffect(() => {
    fetch("/api/leaderboard?period=weekly")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLeaderboard(data.slice(0, 5).map((e: LeaderboardEntry, i: number) => ({ ...e, rank: i + 1 })));
        }
      })
      .catch(() => {});

    fetch("/api/achievements")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAchievements(
            data
              .filter((a: { earned: boolean }) => a.earned)
              .map((a: { name: string; icon: string; earnedAt: string }) => ({
                name: a.name, icon: a.icon, earnedAt: a.earnedAt,
              }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/user/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.weeklyXp) setWeeklyXp(data.weeklyXp);
        if (data.activeDays) setActiveDays(data.activeDays);
        if (typeof data.hearts === "number") setHearts(data.hearts);
        if (data.nextHeartAt) setNextHeartAt(data.nextHeartAt);
      })
      .catch(() => {});

    fetch("/api/knowledge/next-lesson")
      .then((r) => r.json())
      .then((data) => { if (data.pathUrl) setNextLesson(data); })
      .catch(() => {});
  }, []);

  return (
    <AppLayout>
      <AchievementUnlockModal
        show={showAchievementModal}
        achievement={currentAchievement}
        onClose={() => setShowAchievementModal(false)}
      />
      <div className="mx-auto max-w-6xl space-y-2.5">
        {/* Row 1: Welcome + XP — ultra compact */}
        <div className="flex items-center gap-3">
          <AvatarFrame level={level} image={image} name={name} size="md" role={role} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold">
                Привет, <span className="gradient-text">{name || "Разработчик"}</span>
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <StreakCounter streak={streak} />
                <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
              </div>
            </div>
            <div className="mt-1">
              <XPBar currentXp={xp} level={level} showLabel={true} />
            </div>
          </div>
        </div>

        {/* Row 2: 3 CTA cards — compact */}
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
          <Link href={nextLesson?.pathUrl || "/knowledge"} className="block">
            <div className="card-hover relative overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-cyan-500/10 p-3 group hover:border-violet-500/50 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 shrink-0 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold group-hover:text-violet-400 transition-colors">Начать курс</h2>
                  <p className="text-[10px] text-muted-foreground truncate">{nextLesson?.space?.name || "База знаний"}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-violet-400/60 group-hover:text-violet-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/challenges" className="block">
            <div className="card-hover relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 p-3 group hover:border-emerald-500/50 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform">
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold group-hover:text-emerald-400 transition-colors">К задачам</h2>
                  <p className="text-[10px] text-muted-foreground">Решай, зарабатывай опыт</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400/60 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/marathon" className="block">
            <div className="card-hover relative overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-amber-500/10 p-3 group hover:border-orange-500/50 transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 shrink-0 group-hover:scale-110 transition-transform">
                  <Flame className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold group-hover:text-orange-400 transition-colors">Марафон</h2>
                  <p className="text-[10px] text-muted-foreground">Серия ответов × множитель</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </div>
          </Link>
        </div>

        {/* Row 3: Stats Grid */}
        <StatsGrid
          stats={{
            completedChallenges: completedChallenges || 0,
            totalXp: xp || 0,
            rank: rank || 0,
            level: level || 1,
          }}
        />

        {/* Row 4: Activity + Streak — reduced height */}
        <div className="grid gap-2 md:grid-cols-2">
          <WeeklyXpChart data={weeklyXp} />
          <StreakCalendar streak={streak} activeDays={activeDays} />
        </div>

        {/* Row 5: Daily Challenge — horizontal compact */}
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
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        )}

        {/* Row 6: Leaderboard + Achievements — equal width & height */}
        <div className="grid gap-2 md:grid-cols-2">
          <MiniLeaderboard entries={leaderboard} />
          <RecentAchievements achievements={achievements} />
        </div>
      </div>
    </AppLayout>
  );
}
