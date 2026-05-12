"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image: string | null;
  xp: number;
  streak: number;
  level: number;
}

const podiumColors = [
  "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "text-gray-300 border-gray-400/30 bg-gray-400/10",
  "text-amber-600 border-amber-600/30 bg-amber-600/10",
];

const podiumSizes = ["h-20 w-20", "h-16 w-16", "h-16 w-16"];

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
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-end justify-center gap-4 mb-8 pt-4"
              >
                {/* 2nd place */}
                {top3[1] && (
                  <div className="flex flex-col items-center">
                    <Avatar className={cn("border-2 mb-2", podiumColors[1], podiumSizes[1])}>
                      <AvatarImage src={top3[1].image || undefined} />
                      <AvatarFallback className="bg-gray-400/20 text-gray-300">
                        {top3[1].name?.charAt(0)?.toUpperCase() || "2"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-gray-300">{top3[1].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[1].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-16 w-20 rounded-t-lg bg-gray-400/10 border border-gray-400/20 border-b-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-300">2</span>
                    </div>
                  </div>
                )}

                {/* 1st place */}
                {top3[0] && (
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <Medal className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-400" />
                    </div>
                    <Avatar className={cn("border-2 mb-2", podiumColors[0], podiumSizes[0])}>
                      <AvatarImage src={top3[0].image || undefined} />
                      <AvatarFallback className="bg-amber-400/20 text-amber-400 text-xl">
                        {top3[0].name?.charAt(0)?.toUpperCase() || "1"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-bold text-amber-400">{top3[0].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[0].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-24 w-20 rounded-t-lg bg-amber-500/10 border border-amber-500/20 border-b-0 flex items-center justify-center glow-amber">
                      <span className="text-3xl font-bold text-amber-400">1</span>
                    </div>
                  </div>
                )}

                {/* 3rd place */}
                {top3[2] && (
                  <div className="flex flex-col items-center">
                    <Avatar className={cn("border-2 mb-2", podiumColors[2], podiumSizes[2])}>
                      <AvatarImage src={top3[2].image || undefined} />
                      <AvatarFallback className="bg-amber-600/20 text-amber-600">
                        {top3[2].name?.charAt(0)?.toUpperCase() || "3"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-amber-600">{top3[2].name}</p>
                    <p className="text-xs text-muted-foreground">{top3[2].xp.toLocaleString()} XP</p>
                    <div className="mt-2 h-12 w-20 rounded-t-lg bg-amber-600/10 border border-amber-600/20 border-b-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-amber-600">3</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Rest of leaderboard */}
            <div className="glass rounded-xl overflow-hidden">
              {rest.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <span className="w-8 text-center text-sm font-bold text-muted-foreground">
                    {entry.rank}
                  </span>
                  <Avatar className="h-8 w-8 border border-white/10">
                    <AvatarImage src={entry.image || undefined} />
                    <AvatarFallback className="bg-white/5 text-xs">
                      {entry.name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium truncate">{entry.name}</span>
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Flame className="h-3 w-3" />
                    {entry.streak}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                    <Zap className="h-3 w-3" />
                    {entry.xp.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
