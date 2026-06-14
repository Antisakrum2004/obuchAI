"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useDailyChallenge } from "@/hooks/use-daily-challenge";
import { DailyChallengeWidget } from "@/components/dashboard/daily-challenge-widget";
import { MiniLeaderboard } from "@/components/dashboard/mini-leaderboard";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { AchievementUnlockModal, type AchievementData } from "@/components/gamification/achievement-unlock-modal";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { Roadmap, type RoadmapModule } from "@/components/dashboard/roadmap";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { WeeklyXpChart } from "@/components/dashboard/weekly-xp-chart";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  Target,
  Flame,
  Zap,
  Trophy,
  Clock,
  Star,
  Sparkles,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getGradeName, getGradeColor, xpProgressInLevel, calculateLevel } from "@/lib/gamification";

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

interface TodayData {
  solvedToday: number;
  xpToday: number;
  articlesReadToday: number;
  timeline: { type: string; title: string; xp: number; time: string }[];
}

interface ChallengeItem {
  id: string;
  title: string;
  difficulty: string;
  xpReward: number;
  isSolved: boolean;
  cooldownUntil: string | null;
}

/** Default roadmap modules (placeholder until we have a real learning path API) */
const MODULE_NAMES = [
  "Введение в AI", "Промпт-инжиниринг", "Запросы в 1С", "Подзапросы и объединения",
  "AI-агенты", "Дебаггинг с AI", "Автоматизация", "MCP-протокол",
  "Временные таблицы", "Обработка данных", "Продвинутые промпты", "Интеграция API",
  "Оптимизация кода", "Тестирование", "CI/CD с AI", "Архитектура решений",
  "Командная работа", "Финальный проект",
];

function getDefaultModules(count: number, completedCount: number, currentIndex: number): RoadmapModule[] {
  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const status = num <= completedCount ? "completed" : num === currentIndex ? "current" : "locked";
    return {
      id: `mod-${num}`,
      number: num,
      title: MODULE_NAMES[i] || `Модуль ${num}`,
      status,
    };
  });
}

/** Format ISO timestamp to relative time like "5 мин назад" */
function formatTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "сейчас";
    if (mins < 60) return `${mins} мин`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч`;
    return `${Math.floor(hours / 24)} д`;
  } catch {
    return "";
  }
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
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<ChallengeItem[]>([]);
  const [heatmapData, setHeatmapData] = useState<number[][] | undefined>(undefined);

  // Achievement unlock modal state
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
                name: a.name,
                icon: a.icon,
                earnedAt: a.earnedAt,
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
        if (data.heatmapData) setHeatmapData(data.heatmapData);
      })
      .catch(() => {});

    fetch("/api/user/today")
      .then((r) => r.json())
      .then((data) => {
        if (data.solvedToday !== undefined) setTodayData(data);
      })
      .catch(() => {});

    // Load active challenges (unsolved, no cooldown)
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data.challenges && Array.isArray(data.challenges) ? data.challenges : []);
        // Filter to active (unsolved + no cooldown), take top 3
        const active = arr
          .filter((c: ChallengeItem) => !c.isSolved && !c.cooldownUntil)
          .slice(0, 3);
        setActiveChallenges(active);
      })
      .catch(() => {});
  }, []);

  // Grade info
  const gradeName = getGradeName(level);
  const gradeColor = getGradeColor(level);
  const calculatedLevel = calculateLevel(xp);
  const { current: currentXpInLevel, required: requiredXpInLevel, percentage } = xpProgressInLevel(xp);

  // Roadmap data — derive from user level
  const totalModules = 18;
  const completedModules = Math.min(Math.floor(level * 0.5), totalModules - 1);
  const currentModule = completedModules + 1;
  const roadmapModules = getDefaultModules(totalModules, completedModules, currentModule);

  return (
    <AppLayout>
      <AchievementUnlockModal
        show={showAchievementModal}
        achievement={currentAchievement}
        onClose={() => setShowAchievementModal(false)}
      />

      <div className="mx-auto max-w-[1600px]">
        {/* ═══════════════════════════════════════════ */}
        {/* 9+3 GRID LAYOUT                           */}
        {/* ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ═══ LEFT COLUMN — 9 COLS ═══ */}
          <div className="lg:col-span-9 flex flex-col gap-5">

            {/* LESSON HERO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="glass rounded-2xl p-5 flex flex-col min-h-[320px]"
            >
              {/* Hero header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Текущий урок</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {roadmapModules[currentModule - 1]?.title || `Модуль ${currentModule}`} · Запросы в 1С
                    </p>
                  </div>
                </div>
                <Link href="/knowledge/course-map">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20"
                  >
                    {completedChallenges > 0 ? "Продолжить" : "Начать"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              {/* Hero body: lesson + stats side column */}
              <div className="flex-1 flex gap-5 min-h-0">
                {/* Lesson content card */}
                <div className="flex-1 glass rounded-xl p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                      Средний
                    </span>
                    <span className="text-[11px] text-muted-foreground">· 25 мин</span>
                    <span className="text-[11px] text-muted-foreground">· +120 XP</span>
                  </div>
                  <h4 className="font-semibold text-lg mb-2">
                    Сложные запросы: объединения и подзапросы
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Изучите продвинутые техники работы с запросами в 1С: объединение нескольких
                    таблиц, использование подзапросов для фильтрации, временные таблицы и пакетные
                    запросы. На практическом задании закрепите навыки построения эффективных запросов.
                  </p>

                  <div className="mt-auto flex items-center gap-4">
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">65%</span>
                    </div>

                    {/* Avatars (shared progress) */}
                    <div className="flex -space-x-1.5 ml-auto">
                      <div className="w-6 h-6 rounded-full bg-purple-500/30 border-2 border-card flex items-center justify-center text-[9px]">М</div>
                      <div className="w-6 h-6 rounded-full bg-blue-500/30 border-2 border-card flex items-center justify-center text-[9px]">К</div>
                      <div className="w-6 h-6 rounded-full bg-orange-500/30 border-2 border-card flex items-center justify-center text-[9px]">Д</div>
                      <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-card flex items-center justify-center text-[9px]">+5</div>
                    </div>
                  </div>
                </div>

                {/* Stats side column */}
                <div className="w-52 shrink-0 flex flex-col gap-3">
                  <div className="glass rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold gradient-text">{completedChallenges || 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Решено задач</div>
                  </div>
                  <div className="glass rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-orange-400">{streak || 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Дней серия</div>
                  </div>
                  <div className="glass rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">#{rank || "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">В рейтинге</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ROADMAP */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass rounded-2xl p-4"
              style={{ minHeight: "155px" }}
            >
              <Roadmap modules={roadmapModules} completedCount={completedModules} />
            </motion.div>

            {/* TWO-COLUMN: AI Recommendations + Today Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* AI RECOMMENDATIONS */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="glass rounded-2xl p-4 border border-purple-500/15"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <h3 className="font-medium text-sm">Рекомендации AI</h3>
                </div>

                <div className="space-y-2.5">
                  {roadmapModules.filter(m => m.status === "current" || m.status === "locked").slice(0, 3).map((mod, i) => {
                    // Generate contextual recommendation
                    const recommendations = [
                      { text: `Пройдите «${mod.title}» — это основа для следующих модулей`, href: "/knowledge", urgent: mod.status === "current" },
                      { text: `Закрепите «${mod.title}» практическими задачами`, href: "/challenges", urgent: false },
                      { text: `Повторите предыдущий модуль перед «${mod.title}»`, href: "/knowledge/course-map", urgent: false },
                    ];
                    const rec = recommendations[i] || recommendations[0];
                    return (
                      <Link key={mod.id} href={rec.href} className="block group">
                        <div className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-xl transition-all",
                          rec.urgent ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/3 hover:bg-white/5"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                            rec.urgent ? "bg-purple-400" : "bg-white/20"
                          )} />
                          <p className={cn(
                            "text-xs leading-relaxed",
                            rec.urgent ? "text-purple-200" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {rec.text}
                          </p>
                        </div>
                      </Link>
                    );
                  })}

                  {roadmapModules.filter(m => m.status !== "completed").length === 0 && (
                    <div className="text-center py-3">
                      <p className="text-xs text-emerald-400 font-medium">Все модули пройдены! 🎉</p>
                      <Link href="/knowledge/course-map" className="text-[10px] text-muted-foreground hover:text-foreground mt-1 inline-block">
                        Повторить курс →
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* TODAY TIMELINE */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-cyan-400" />
                    </div>
                    <h3 className="font-medium text-sm">Сегодня</h3>
                  </div>
                  {todayData && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      +{todayData.xpToday} XP
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-white/3 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-emerald-400">
                      {todayData?.solvedToday || 0}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Задач</div>
                  </div>
                  <div className="flex-1 bg-white/3 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-cyan-400">
                      {todayData?.articlesReadToday || 0}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Статей</div>
                  </div>
                  <div className="flex-1 bg-white/3 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-amber-400">
                      {todayData?.xpToday || 0}
                    </div>
                    <div className="text-[9px] text-muted-foreground">XP</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scroll">
                  {todayData && todayData.timeline.length > 0 ? (
                    todayData.timeline.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                        <div className={cn(
                          "shrink-0",
                          item.type === "solved" ? "text-emerald-400" : "text-red-400/50"
                        )}>
                          {item.type === "solved" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Target className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <span className="text-[11px] text-foreground truncate flex-1">{item.title}</span>
                        {item.xp > 0 && (
                          <span className="text-[10px] text-emerald-400 font-medium shrink-0">+{item.xp}</span>
                        )}
                        <span className="text-[9px] text-muted-foreground/50 shrink-0">
                          {formatTime(item.time)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground/50">Пока нет активности</p>
                      <Link href="/challenges" className="text-[10px] text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                        Начать решать →
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — 3 COLS ═══ */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* ACTIVE TASKS */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="flex-1 glass rounded-2xl p-4 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">Активные задачи</h3>
                <span className="text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                  {activeChallenges.length}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto custom-scroll pr-1">
                {activeChallenges.length > 0 ? activeChallenges.map((ch) => {
                  const diffConfig: Record<string, { label: string; bg: string; text: string; bar: string }> = {
                    hard: { label: "Сложный", bg: "bg-red-500/15", text: "text-red-400", bar: "bg-red-400" },
                    medium: { label: "Средний", bg: "bg-yellow-500/15", text: "text-yellow-400", bar: "bg-yellow-400" },
                    easy: { label: "Лёгкий", bg: "bg-emerald-500/15", text: "text-emerald-400", bar: "bg-emerald-400" },
                  };
                  const cfg = diffConfig[ch.difficulty] || diffConfig.easy;
                  return (
                    <Link key={ch.id} href={`/challenges/${ch.id}`}>
                      <div className="task-item">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} font-medium`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">+{ch.xpReward} XP</span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{ch.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${cfg.bar} rounded-full`} style={{ width: "0%" }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">0%</span>
                        </div>
                      </div>
                    </Link>
                  );
                }) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground/50">Нет доступных задач</p>
                    <Link href="/challenges" className="text-[10px] text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                      Все задачи →
                    </Link>
                  </div>
                )}

                {/* Daily task */}
                {!dailyLoading && dailyData?.challenge && (
                  <Link href="/challenges">
                    <div className="task-item border-emerald-500/20 bg-emerald-500/5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                          Ежедневная
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">+{dailyData.challenge.xpReward || 60} XP</span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{dailyData.challenge.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: dailyData.completed ? "100%" : "0%" }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {dailyData.completed ? "100%" : "0%"}
                        </span>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* ACTIVITY HEATMAP */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="glass rounded-2xl p-4"
              style={{ minHeight: "150px" }}
            >
              <ActivityHeatmap weeks={12} data={heatmapData} />
            </motion.div>

            {/* MARATHON CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Link href="/marathon" className="block">
                <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-amber-500/10 p-4 group hover:border-orange-500/50 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Flame className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold group-hover:text-orange-400 transition-colors">Марафон</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Серия правильных ответов = множитель XP
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
