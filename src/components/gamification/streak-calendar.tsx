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

export function StreakCalendar({ streak, activeDays = [], className }: StreakCalendarProps) {
  // Get last 7 days
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = (date.getDay() + 6) % 7; // Monday=0
    const isoDate = date.toISOString().split("T")[0];
    const isActive = activeDays.includes(isoDate);
    const isToday = i === 0;
    const isFuture = date > today;

    days.push({ date, dayOfWeek, isoDate, isActive, isToday, isFuture });
  }

  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className={cn("h-5 w-5", streak > 0 ? "text-amber-400 fire-pulse" : "text-muted-foreground")} />
          <span className="text-sm font-semibold">Серия</span>
        </div>
        <span className={cn("text-2xl font-black", streak > 0 ? "text-amber-400" : "text-muted-foreground")}>
          {streak}
        </span>
      </div>

      {/* 7-day dots */}
      <div className="flex items-center justify-between gap-1">
        {days.map((day) => (
          <div key={day.isoDate} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {DAY_LABELS[day.dayOfWeek]}
            </span>
            <div className="relative">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  day.isActive && "bg-amber-500/20 border-2 border-amber-500/40 text-amber-400",
                  day.isActive && day.isToday && "bg-amber-500/30 border-amber-500/60 glow-amber",
                  !day.isActive && !day.isFuture && "bg-white/5 border border-white/10 text-muted-foreground/50",
                  day.isFuture && "bg-white/[0.02] border border-white/5 text-muted-foreground/20",
                  day.isToday && !day.isActive && "border-amber-500/30 border-2"
                )}
              >
                {day.isActive ? (
                  <Flame className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[10px]">{day.date.getDate()}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Streak status */}
      <div className="mt-3 text-center">
        {streak > 0 ? (
          <p className="text-xs text-amber-400/80">
            {streak} {streak === 1 ? "день" : streak < 5 ? "дня" : "дней"} подряд! 🔥
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Реши задачу сегодня чтобы начать серию
          </p>
        )}
      </div>
    </div>
  );
}
