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
    <div className={cn("glass rounded-xl p-4", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-5 w-5 text-purple-400" />
        <h3 className="font-semibold">Последние достижения</h3>
      </div>

      {achievements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Решайте задачи, чтобы получить достижения!
        </p>
      ) : (
        <div className="space-y-2">
          {achievements.map((achievement, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
            >
              <span className="text-xl">{achievement.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium gradient-text truncate">
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
