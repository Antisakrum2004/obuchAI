"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  streak: number;
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
    <div className={cn("glass rounded-xl p-4", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold">Топ игроков</h3>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Пока нет данных</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.rank}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                entry.isCurrentUser
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "hover:bg-white/5"
              )}
            >
              <span
                className={cn(
                  "w-6 text-center text-sm font-bold",
                  rankStyles[entry.rank] || "text-muted-foreground"
                )}
              >
                {entry.rank}
              </span>
              <Avatar className="h-7 w-7 border border-white/10">
                <AvatarFallback className="bg-white/5 text-xs">
                  {entry.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "flex-1 text-sm truncate",
                  entry.isCurrentUser ? "text-emerald-400 font-medium" : ""
                )}
              >
                {entry.name || "Аноним"}
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.xp.toLocaleString()} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
