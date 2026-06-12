"use client";

import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

interface StreakCalendarProps {
  streak: number;
  /** ISO date strings of days the user was active (earned XP) */
  activeDays?: string[];
  className?: string;
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Format date as YYYY-MM-DD in local timezone */
function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function StreakCalendar({ streak, activeDays = [], className }: StreakCalendarProps) {
  const days: { date: Date; dayOfWeek: number; isoDate: string; isActive: boolean; isToday: boolean; isFuture: boolean; streakDay: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = (date.getDay() + 6) % 7;
    const isoDate = toLocalISODate(date);
    const isActive = activeDays.includes(isoDate);
    const isToday = i === 0;
    const isFuture = date > today;

    let streakDay = 0;
    if (streak > 0 && i < streak) {
      streakDay = streak - i;
    }

    days.push({ date, dayOfWeek, isoDate, isActive, isToday, isFuture, streakDay });
  }

  return (
    <div className={cn("glass rounded-xl p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Flame className={cn("h-3.5 w-3.5", streak > 0 ? "text-amber-400 fire-pulse" : "text-muted-foreground")} />
          <span className="text-xs font-semibold">Серия</span>
        </div>
        <span className={cn("text-lg font-black", streak > 0 ? "text-amber-400" : "text-muted-foreground")}>
          {streak}
        </span>
      </div>

      {/* 7-day dots — compact */}
      <div className="flex items-center justify-between gap-0.5">
        {days.map((day) => {
          const hasFlame = day.streakDay > 0;

          return (
            <div
              key={day.isoDate}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[9px] text-muted-foreground">
                {DAY_LABELS[day.dayOfWeek]}
              </span>
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all",
                  hasFlame && "bg-amber-500/20 border-2 border-amber-500/40 text-amber-400",
                  hasFlame && day.isToday && "bg-amber-500/30 border-amber-500/60",
                  !hasFlame && day.isActive && "bg-amber-500/15 border-2 border-amber-500/30 text-amber-400",
                  !hasFlame && !day.isActive && !day.isFuture && "bg-white/5 border border-white/10 text-muted-foreground/50",
                  day.isFuture && "bg-white/[0.02] border border-white/5 text-muted-foreground/20",
                  day.isToday && !hasFlame && "border-amber-500/30 border-2"
                )}
              >
                {hasFlame ? (
                  <Flame className="h-3 w-3 text-amber-400" />
                ) : (
                  <span>{day.date.getDate()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak status */}
      <div className="mt-1.5 text-center">
        {streak > 0 ? (
          <p className="text-[10px] text-amber-400/80">
            {streak} {streak === 1 ? "день" : streak < 5 ? "дня" : "дней"} подряд!
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Реши задачу сегодня чтобы начать серию
          </p>
        )}
      </div>
    </div>
  );
}
