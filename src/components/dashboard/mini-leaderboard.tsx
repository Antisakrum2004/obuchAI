"use client";

import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

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

interface MiniLeaderboardProps {
  entries: LeaderboardEntry[];
  className?: string;
}

const rankStyles: Record<number, string> = {
  1: "text-amber-400",
  2: "text-gray-300",
  3: "text-amber-600",
};

export function MiniLeaderboard({ entries, className }: MiniLeaderboardProps) {
  return (
    <div className={cn("glass rounded-xl p-3 flex flex-col h-full", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Топ игроков</h3>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Пока нет данных</p>
      ) : (
        <div className="space-y-1 flex-1">
          {entries.slice(0, 3).map((entry) => (
            <div
              key={entry.rank}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                entry.isCurrentUser
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "hover:bg-white/5"
              )}
            >
              <span
                className={cn(
                  "w-5 text-center text-xs font-bold",
                  rankStyles[entry.rank] || "text-muted-foreground"
                )}
              >
                {entry.rank}
              </span>
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                entry.rank === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                entry.rank === 2 ? "bg-gray-500/20 text-gray-300 border border-gray-500/20" :
                "bg-amber-700/20 text-amber-600 border border-amber-700/20"
              )}>
                {entry.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <span
                className={cn(
                  "flex-1 text-xs truncate",
                  entry.isCurrentUser ? "text-emerald-400 font-medium" : ""
                )}
              >
                {entry.name || "Аноним"}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {entry.xp.toLocaleString()} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
