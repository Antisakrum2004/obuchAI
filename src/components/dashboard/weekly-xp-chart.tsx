"use client";

import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

interface WeeklyXpChartProps {
  /** XP earned each day for the last 7 days: [Mon, Tue, Wed, Thu, Fri, Sat, Sun] */
  data: number[];
  className?: string;
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeeklyXpChart({ data, className }: WeeklyXpChartProps) {
  const maxVal = Math.max(...data, 1); // avoid division by zero

  // Get which day index is "today" (Monday=0)
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7;

  // Total XP this week
  const totalXp = data.reduce((sum, v) => sum + v, 0);

  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3 pt-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold">Активность</span>
        </div>
        <span className="text-xs text-muted-foreground">{totalXp} XP за неделю</span>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-28">
        {data.map((value, i) => {
          // Cap at 85% max to leave headroom for value labels above
          const height = Math.max((value / maxVal) * 85, value > 0 ? 8 : 2);
          const isToday = i === todayIndex;
          const hasValue = value > 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {/* Value label — placed ABOVE the bar container */}
              <span className={cn(
                "text-[10px] font-medium transition-opacity h-4 flex items-end",
                hasValue ? "text-emerald-400 opacity-100" : "text-muted-foreground/30 opacity-0"
              )}>
                {value > 0 ? value : ""}
              </span>
              {/* Bar container */}
              <div className="w-full relative" style={{ height: "90px" }}>
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t-md transition-all duration-500",
                    isToday && hasValue
                      ? "bg-emerald-500/40 glow-emerald"
                      : hasValue
                      ? "bg-emerald-500/20"
                      : "bg-white/5"
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
              {/* Day label */}
              <span className={cn(
                "text-[10px]",
                isToday ? "text-emerald-400 font-bold" : "text-muted-foreground/50"
              )}>
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
