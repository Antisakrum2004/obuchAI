"use client";

import { cn } from "@/lib/utils";
import { Award } from "lucide-react";

interface RecentAchievementsProps {
  achievements: {
    name: string;
    icon: string;
    earnedAt: string;
  }[];
  className?: string;
}

export function RecentAchievements({ achievements, className }: RecentAchievementsProps) {
  return (
    <div className={cn("glass rounded-xl p-3 flex flex-col h-full", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Award className="h-4 w-4 text-purple-400" />
        <h3 className="text-sm font-semibold">Последние достижения</h3>
      </div>

      {achievements.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Решайте задачи, чтобы получить достижения!
        </p>
      ) : (
        <div className="space-y-1 flex-1">
          {achievements.slice(0, 3).map((achievement, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-base">{achievement.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium gradient-text truncate">
                  {achievement.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
