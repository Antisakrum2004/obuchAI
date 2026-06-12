"use client";

import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

interface WeeklyXpChartProps {
  data: number[];
  className?: string;
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeeklyXpChart({ data, className }: WeeklyXpChartProps) {
  const maxVal = Math.max(...data, 1);
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7;
  const totalXp = data.reduce((sum, v) => sum + v, 0);

  return (
    <div className={cn("glass rounded-xl p-2.5", className)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-emerald-400" />
          <span className="text-xs font-semibold">Активность</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{totalXp} XP за неделю</span>
      </div>

      {/* Bar chart — half the original height */}
      <div className="flex items-end gap-1.5 h-14">
        {data.map((value, i) => {
          const height = Math.max((value / maxVal) * 70, value > 0 ? 8 : 2);
          const isToday = i === todayIndex;
          const hasValue = value > 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className={cn(
                "text-[8px] font-medium h-3 flex items-end",
                hasValue ? "text-emerald-400" : "opacity-0"
              )}>
                {value > 0 ? value : ""}
              </span>
              <div className="w-full relative" style={{ height: "32px" }}>
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t transition-all duration-500",
                    isToday && hasValue ? "bg-emerald-500/40" : hasValue ? "bg-emerald-500/20" : "bg-white/5"
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={cn(
                "text-[8px]",
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
