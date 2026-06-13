"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useDailyChallenge } from "@/hooks/use-daily-challenge";
import { DailyChallengeWidget } from "@/components/dashboard/daily-challenge-widget";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { MiniLeaderboard } from "@/components/dashboard/mini-leaderboard";
import { RecentAchievements } from "@/components/dashboard/recent-achievements";
import { WeeklyXpChart } from "@/components/dashboard/weekly-xp-chart";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCalendar } from "@/components/gamification/streak-calendar";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { AchievementUnlockModal, type AchievementData } from "@/components/gamification/achievement-unlock-modal";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Target, ArrowRight, Flame, BookOpen, CheckCircle2, Circle, Lock, Play, Trophy, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getGradeName, getGradeColor } from "@/lib/gamification";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

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

interface SpaceProgress {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  totalArticles: number;
  completedArticles: number;
}

interface CourseProgressData {
  spaces: SpaceProgress[];
  totalArticles: number;
  totalCompleted: number;
  percentage: number;
  hasStarted: boolean;
  isComplete: boolean;
  nextLesson: { id: string; title: string; slug: string; spaceSlug: string; spaceName: string } | null;
  firstLesson: { id: string; title: string; slug: string; spaceName: string } | null;
}

// ── Grade Scale Data ──────────────────────────────────────────

const gradeSteps = [
  { level: 1, name: "Начинающий", color: "text-emerald-400" },
  { level: 5, name: "Специалист", color: "text-blue-400" },
  { level: 10, name: "Мастер", color: "text-purple-400" },
  { level: 15, name: "Про", color: "text-amber-400" },
  { level: 20, name: "Звезда", color: "text-yellow-400" },
  { level: 25, name: "Легенда", color: "text-rose-400" },
];

// ── Dashboard ─────────────────────────────────────────────────

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
  const [courseProgress, setCourseProgress] = useState<CourseProgressData | null>(null);

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

    // Fetch course progress
    fetch("/api/knowledge/course-progress")
      .then((r) => r.json())
      .then((data) => { setCourseProgress(data); })
      .catch(() => {});
  }, []);

  // Determine CTA button state
  const courseCta = (() => {
    if (!courseProgress) {
      return {
        label: "Начать курс",
        subtitle: "База знаний",
        href: nextLesson?.pathUrl || "/knowledge",
      };
    }
    if (courseProgress.isComplete) {
      return {
        label: "Повторить курс",
        subtitle: courseProgress.firstLesson?.spaceName || "База знаний",
        href: courseProgress.firstLesson
          ? `/knowledge/${encodeURIComponent(courseProgress.firstLesson.slug)}/learn/${courseProgress.firstLesson.id}`
          : "/knowledge",
      };
    }
    if (courseProgress.hasStarted && courseProgress.nextLesson) {
      return {
        label: "Продолжить обучение",
        subtitle: courseProgress.nextLesson.title,
        href: `/knowledge/${encodeURIComponent(courseProgress.nextLesson.spaceSlug)}/learn/${courseProgress.nextLesson.id}`,
      };
    }
    return {
      label: "Начать курс",
      subtitle: courseProgress.spaces[0]?.name || "База знаний",
      href: courseProgress.nextLesson
        ? `/knowledge/${encodeURIComponent(courseProgress.nextLesson.spaceSlug)}/learn/${courseProgress.nextLesson.id}`
        : nextLesson?.pathUrl || "/knowledge",
    };
  })();

  // Determine current grade step index
  const currentGradeIdx = gradeSteps.reduce((idx, step, i) => (level >= step.level ? i : idx), 0);
  const nextGrade = gradeSteps[currentGradeIdx + 1] || null;

  return (
    <AppLayout>
      <AchievementUnlockModal
        show={showAchievementModal}
        achievement={currentAchievement}
        onClose={() => setShowAchievementModal(false)}
      />
      <div className="mx-auto max-w-6xl space-y-3">
        {/* Row 1: Welcome + XP + Course Mini Progress */}
        <div className="flex items-center gap-3">
          <AvatarFrame level={level} image={image} name={name} size="md" role={role} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">
                Привет, <span className="gradient-text">{name || "Разработчик"}</span>
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <HeartsDisplay hearts={hearts} nextHeartAt={nextHeartAt} />
              </div>
            </div>
            <div className="mt-1">
              <XPBar currentXp={xp} level={level} showLabel={true} />
            </div>
            {/* Mini course progress under XP bar */}
            {courseProgress && courseProgress.totalArticles > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 max-w-[200px]">
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${courseProgress.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {courseProgress.totalCompleted}/{courseProgress.totalArticles} уроков
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Course CTA + Progress Widget + Grade Scale */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
          {/* Main CTA card */}
          <Link href={courseCta.href} className="block lg:col-span-2">
            <div className="card-hover relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-cyan-500/10 p-5 group hover:border-violet-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  {courseProgress?.hasStarted && !courseProgress?.isComplete ? (
                    <Play className="h-7 w-7 text-violet-400" />
                  ) : courseProgress?.isComplete ? (
                    <Trophy className="h-7 w-7 text-amber-400" />
                  ) : (
                    <BookOpen className="h-7 w-7 text-violet-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground group-hover:text-violet-400 transition-colors">
                    {courseCta.label}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{courseCta.subtitle}</p>
                  {/* Progress bar for started courses */}
                  {courseProgress && courseProgress.hasStarted && !courseProgress.isComplete && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
                            style={{ width: `${courseProgress.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{courseProgress.percentage}%</span>
                    </div>
                  )}
                  {courseProgress?.isComplete && (
                    <Badge variant="outline" className="mt-1 border-amber-500/30 text-amber-400 bg-amber-500/10 text-[10px]">
                      Курс пройден!
                    </Badge>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-violet-400/60 group-hover:text-violet-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
              </div>
            </div>
          </Link>

          {/* Grade Scale "К чему стремиться" */}
          <div className="glass rounded-2xl border border-white/5 p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              К чему стремиться
            </h3>
            <div className="space-y-2">
              {gradeSteps.map((step, idx) => {
                const isReached = level >= step.level;
                const isCurrent = idx === currentGradeIdx;
                const isNext = idx === currentGradeIdx + 1;
                return (
                  <div key={step.level} className="flex items-center gap-2">
                    {isReached ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : isNext ? (
                      <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className={cn(
                      "text-xs",
                      isReached ? "text-foreground font-medium" : isNext ? "text-amber-400 font-medium" : "text-muted-foreground/50"
                    )}>
                      {step.name}
                    </span>
                    <span className={cn("text-[10px] ml-auto", step.color)}>
                      Lvl {step.level}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shrink-0">
                        Вы
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {nextGrade && (
              <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-muted-foreground">
                До <span className={nextGrade.color}>{nextGrade.name}</span>: Lvl {nextGrade.level - level} осталось
              </div>
            )}
          </div>
        </div>

        {/* Row 2.5: Course Progress Map (section icons + progress) */}
        {courseProgress && courseProgress.spaces.length > 0 && (
          <div className="glass rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-emerald-400" />
                Прогресс по разделам
              </h3>
              <span className="text-xs text-muted-foreground">
                {courseProgress.totalCompleted} из {courseProgress.totalArticles} уроков
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {courseProgress.spaces.map((space, idx) => {
                const isComplete = space.completedArticles >= space.totalArticles && space.totalArticles > 0;
                const isStarted = space.completedArticles > 0;
                const isCurrent = !isComplete && (isStarted || (idx === 0 && !courseProgress.hasStarted));
                const isLocked = !isComplete && !isCurrent;
                const pct = space.totalArticles > 0 ? Math.round((space.completedArticles / space.totalArticles) * 100) : 0;

                return (
                  <Link
                    key={space.id}
                    href={`/knowledge/${encodeURIComponent(space.slug)}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all shrink-0 min-w-[140px]",
                      isComplete
                        ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                        : isCurrent
                        ? "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-sm",
                      isComplete ? "bg-emerald-500/20 text-emerald-400" : isCurrent ? "bg-violet-500/20 text-violet-400" : "bg-white/5 text-muted-foreground/40"
                    )}>
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : space.icon && isEmojiIcon(space.icon) ? (
                        <span>{space.icon}</span>
                      ) : (
                        <span className="text-[10px] font-bold">{getAbbrev(space.name)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium truncate",
                        isComplete ? "text-emerald-400" : isCurrent ? "text-violet-400" : "text-muted-foreground/50"
                      )}>
                        {space.name}
                      </p>
                      {space.totalArticles > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                isComplete ? "bg-emerald-500" : "bg-violet-500"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground">{space.completedArticles}/{space.totalArticles}</span>
                        </div>
                      )}
                    </div>
                    {!isLocked && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2.8: Other CTA cards */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Link href="/challenges" className="block">
            <div className="card-hover relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 p-4 group hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground group-hover:text-emerald-400 transition-colors">К задачам</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Решай, зарабатывай опыт</p>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-400/60 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
              </div>
            </div>
          </Link>

          <Link href="/marathon" className="block">
            <div className="card-hover relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-amber-500/10 p-4 group hover:border-orange-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Flame className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground group-hover:text-orange-400 transition-colors">Марафон</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Серия ответов × множитель XP</p>
                </div>
                <ArrowRight className="h-4 w-4 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
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

        {/* Row 4: Activity + Streak — half height */}
        <div className="grid gap-2 md:grid-cols-2">
          <WeeklyXpChart data={weeklyXp} />
          <StreakCalendar streak={streak} activeDays={activeDays} />
        </div>

        {/* Row 5: Daily Challenge — horizontal full-width */}
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

// ── Helpers ──────────────────────────────────────────────────────

function isEmojiIcon(str: string): boolean {
  const graphemes = [...str];
  return graphemes.length <= 2 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}

function getAbbrev(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}
