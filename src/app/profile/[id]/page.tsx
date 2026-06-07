"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { ShareCardButton } from "@/components/profile/share-card";
import { ReferralCard } from "@/components/profile/referral-card";
import { PremiumAchievementCard, type AchievementRarity } from "@/components/gamification/premium-achievement-card";
import { type AchievementIconName } from "@/components/gamification/achievement-icons";
import { categoryLabel } from "@/lib/gamification";

// Icon mapping for profile achievements
const ACHIEVEMENT_ICONS_MAP_PROFILE: Record<string, AchievementIconName> = {
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
import { useUserStore } from "@/store/user-store";
import { motion } from "framer-motion";
import {
  Calendar,
  Trophy,
  Target,
  Crosshair,
  ArrowLeft,
  LogOut,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "next-auth/react";

interface ProfileData {
  id: string;
  name: string;
  image: string | null;
  xp: number;
  level: number;
  streak: number;
  maxStreak: number;
  createdAt: string;
  role: string | null;
  rank: number;
  achievements: {
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    category: string;
    xpReward: number;
    earnedAt: string;
  }[];
  stats: {
    completedChallenges: number;
    totalAttempts: number;
    accuracy: number;
  };
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function ProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const currentUserId = useUserStore((s) => s.id);
  const isOwnProfile = currentUserId === id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch(`/api/user/profile/${id}`);
        if (!res.ok) throw new Error("Не найден");
        const data = await res.json();
        if (!cancelled) {
          setProfile(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Профиль не найден");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Back link skeleton */}
          <Skeleton className="h-4 w-16" />

          {/* Profile header skeleton */}
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar skeleton */}
              <Skeleton className="h-24 w-24 rounded-full shrink-0" />
              {/* Name + details skeleton */}
              <div className="flex-1 space-y-3 w-full">
                <Skeleton className="h-8 w-48" />
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <Skeleton className="h-2 w-full max-w-sm rounded-full" />
              </div>
              {/* Share button skeleton */}
              <Skeleton className="h-9 w-20 rounded-md shrink-0" />
            </div>
          </div>

          {/* Stats cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 text-center space-y-2">
                <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
                <Skeleton className="h-7 w-12 mx-auto" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            ))}
          </div>

          {/* Two-column skeleton */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass rounded-xl p-4 space-y-3">
              <Skeleton className="h-5 w-20" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
            <div className="glass rounded-xl p-4 space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">🔍</div>
            <h2 className="text-xl font-bold">Профиль не найден</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Пользователь не существует или профиль недоступен
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2 border-white/10">
                <ArrowLeft className="h-4 w-4" />
                На главную
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const registeredDate = new Date(profile.createdAt).toLocaleDateString(
    "ru-RU",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Назад
          </Link>
        </motion.div>

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            {/* Background glow accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar with tier frame */}
              <AvatarFrame
                level={profile.level}
                image={profile.image}
                name={profile.name}
                size="lg"
                role={profile.role}
              />

              {/* Name + details */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold md:text-3xl">
                  <span className="gradient-text">{profile.name}</span>
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 bg-purple-500/10 gap-1"
                  >
                    <Trophy className="h-3 w-3" />
                    Рейтинг #{profile.rank}
                  </Badge>
                  <StreakCounter streak={profile.streak} />
                  <Badge
                    variant="outline"
                    className="border-white/10 text-muted-foreground bg-white/5 gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    {registeredDate}
                  </Badge>
                </div>

                {/* XP Progress */}
                <div className="mt-4 max-w-sm mx-auto sm:mx-0">
                  <XPBar
                    currentXp={profile.xp}
                    level={profile.level}
                    showLabel={true}
                  />
                </div>
              </div>

              {/* Share button */}
              <div className="shrink-0">
                <ShareCardButton profile={profile} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {profile.stats.completedChallenges}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Задач решено
              </p>
            </div>

            <div className="glass rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Crosshair className="h-4 w-4 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {profile.stats.totalAttempts}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Всего попыток
              </p>
            </div>

            <div className="glass rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
                  <Crosshair className="h-4 w-4 text-pink-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-pink-400">
                {profile.stats.accuracy}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Точность</p>
            </div>

            <div className="glass rounded-xl p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Trophy className="h-4 w-4 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-400">
                {profile.maxStreak}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Макс. серия
              </p>
            </div>
          </div>
        </motion.div>

        {/* Referral Card (only on own profile) */}
        {isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <ReferralCard />
          </motion.div>
        )}

        {/* Achievements section (full width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold mb-4">
              Достижения ({profile.achievements.length})
            </h3>
              {profile.achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Достижений пока нет
                </p>
              ) : (
                <div
                  className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto pr-1"
                >
                  {profile.achievements.map((achievement) => {
                    const slugKey = achievement.slug?.toLowerCase().replace(/_/g, "-") || "";
                    const iconName: AchievementIconName | undefined = ACHIEVEMENT_ICONS_MAP_PROFILE[slugKey];
                    let rarity: AchievementRarity = "common";
                    if (achievement.xpReward >= 1000) rarity = "legendary";
                    else if (achievement.xpReward >= 500) rarity = "epic";
                    else if (achievement.xpReward >= 150) rarity = "rare";
                    return (
                      <PremiumAchievementCard
                        key={achievement.id}
                        name={achievement.name}
                        description={achievement.description}
                        icon={achievement.icon}
                        iconName={iconName}
                        rarity={rarity}
                        xpReward={achievement.xpReward}
                        earned={true}
                        earnedAt={achievement.earnedAt}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

        {/* Account actions — only on own profile */}
        {isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <Link href="/about" className="flex-1">
              <Button
                variant="outline"
                className="w-full gap-2 border-white/10 bg-white/5 hover:bg-white/10"
              >
                <Info className="h-4 w-4" />
                О проекте
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="flex-1 gap-2 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
