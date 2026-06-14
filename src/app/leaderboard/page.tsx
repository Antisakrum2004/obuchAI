"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image: string | null;
  xp: number;
  streak: number;
  level: number;
  role: string | null;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState("alltime");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/leaderboard?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeaderboard();
  }, [period]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl font-bold">Рейтинг</h1>
          </div>
          <p className="text-muted-foreground">
            Лучшие разработчики платформы
          </p>
        </motion.div>

        {/* Period tabs */}
        <Tabs value={period} onValueChange={setPeriod} className="mb-6">
          <TabsList className="bg-white/5 border border-white/5">
            <TabsTrigger value="weekly" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Неделя
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Месяц
            </TabsTrigger>
            <TabsTrigger value="alltime" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Всё время
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass rounded-xl p-4 shimmer h-16" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Пока нет данных</p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 with avatar frames */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-end justify-center gap-4 mb-8 pt-4"
              >
                {/* 2nd place */}
                {top3[1] && (
                  <Link href={`/profile/${top3[1].id}`} className="flex flex-col items-center group">
                    <div className="mb-2">
                      <AvatarFrame
                        level={top3[1].level}
                        image={top3[1].image}
                        name={top3[1].name}
                        size="sm"
                        role={top3[1].role}
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{top3[1].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[1].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-16 w-20 rounded-t-lg bg-gray-400/10 border border-gray-400/20 border-b-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-300">2</span>
                    </div>
                  </Link>
                )}

                {/* 1st place */}
                {top3[0] && (
                  <Link href={`/profile/${top3[0].id}`} className="flex flex-col items-center group">
                    <div className="relative mb-2">
                      <Medal className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-400 z-10" />
                      <AvatarFrame
                        level={top3[0].level}
                        image={top3[0].image}
                        name={top3[0].name}
                        size="md"
                        role={top3[0].role}
                      />
                    </div>
                    <p className="text-sm font-bold text-amber-400 group-hover:text-amber-300 transition-colors">{top3[0].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[0].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-24 w-20 rounded-t-lg bg-amber-500/10 border border-amber-500/20 border-b-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-amber-400">1</span>
                    </div>
                  </Link>
                )}

                {/* 3rd place */}
                {top3[2] && (
                  <Link href={`/profile/${top3[2].id}`} className="flex flex-col items-center group">
                    <div className="mb-2">
                      <AvatarFrame
                        level={top3[2].level}
                        image={top3[2].image}
                        name={top3[2].name}
                        size="sm"
                        role={top3[2].role}
                      />
                    </div>
                    <p className="text-sm font-medium text-amber-600 group-hover:text-amber-500 transition-colors">{top3[2].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[2].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-12 w-20 rounded-t-lg bg-amber-600/10 border border-amber-600/20 border-b-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-amber-600">3</span>
                    </div>
                  </Link>
                )}
              </motion.div>
            )}

            {/* Rest of leaderboard — with avatar frames */}
            <div className="glass rounded-xl overflow-hidden">
              {rest.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                >
                  <Link
                    href={`/profile/${entry.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                  >
                    <span className="w-8 text-center text-sm font-bold text-muted-foreground">
                      {entry.rank}
                    </span>
                    <AvatarFrame
                      level={entry.level}
                      image={entry.image}
                      name={entry.name}
                      size="sm"
                      role={entry.role}
                    />
                    <span className="flex-1 text-sm font-medium truncate">{entry.name}</span>
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Flame className="h-3 w-3" />
                      {entry.streak}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                      <Zap className="h-3 w-3" />
                      {entry.xp.toLocaleString()}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
