"use client";

import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface StreakCalendarProps {
  streak: number;
  /** ISO date strings of days the user was active (earned XP) */
  activeDays?: string[];
  className?: string;
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Format date as YYYY-MM-DD in local timezone (avoids UTC offset issues) */
function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function StreakCalendar({ streak, activeDays = [], className }: StreakCalendarProps) {
  // Get last 7 days
  const days: { date: Date; dayOfWeek: number; isoDate: string; isActive: boolean; isToday: boolean; isFuture: boolean; streakDay: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = (date.getDay() + 6) % 7; // Monday=0
    const isoDate = toLocalISODate(date);
    const isActive = activeDays.includes(isoDate);
    const isToday = i === 0;
    const isFuture = date > today;

    // ★ KEY FIX: A day is part of the streak if it falls within the streak range
    // counting back from today, regardless of whether the API reported it as "active"
    // i=0 → today (streak day N), i=1 → yesterday (streak day N-1), etc.
    let streakDay = 0;
    if (streak > 0 && i < streak) {
      // This day is within the streak range
      streakDay = streak - i;
    }

    days.push({ date, dayOfWeek, isoDate, isActive, isToday, isFuture, streakDay });
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
        {days.map((day, index) => {
          // ★ Flame intensity based on streak day number
          // Day 1: barely lit, Day 7+: fully on fire
          const flameIntensity = day.streakDay > 0
            ? Math.min(day.streakDay / 7, 1)
            : 0;
          // ★ Show flame on EVERY day that's part of the streak
          const hasFlame = day.streakDay > 0;
          const isLargeFlame = day.streakDay >= 7;

          return (
            <motion.div
              key={day.isoDate}
              className="flex flex-col items-center gap-1.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.07,
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              <span className="text-[10px] text-muted-foreground">
                {DAY_LABELS[day.dayOfWeek]}
              </span>
              <div className="relative">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    // ★ Streak day styling (active or not — if it's part of streak, show fire)
                    hasFlame && "bg-amber-500/20 border-2 border-amber-500/40 text-amber-400",
                    hasFlame && day.isToday && "bg-amber-500/30 border-amber-500/60",
                    // Active but not in streak range (shouldn't happen normally)
                    !hasFlame && day.isActive && "bg-amber-500/15 border-2 border-amber-500/30 text-amber-400",
                    // Inactive
                    !hasFlame && !day.isActive && !day.isFuture && "bg-white/5 border border-white/10 text-muted-foreground/50",
                    day.isFuture && "bg-white/[0.02] border border-white/5 text-muted-foreground/20",
                    day.isToday && !hasFlame && "border-amber-500/30 border-2"
                  )}
                  style={
                    day.isToday && hasFlame
                      ? { animation: "streak-today-pulse 2s ease-in-out infinite" }
                      : undefined
                  }
                >
                  {hasFlame ? (
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: index * 0.07 + 0.15,
                        type: "spring",
                        stiffness: 300,
                        damping: 15,
                      }}
                      className="relative flex items-center justify-center"
                    >
                      {/* Flame icon — size/color based on streak day */}
                      <Flame
                        className={cn(
                          isLargeFlame
                            ? "h-4 w-4"
                            : "h-3.5 w-3.5",
                          isLargeFlame
                            ? "text-orange-400"
                            : "text-amber-400"
                        )}
                        style={{
                          opacity: 0.4 + flameIntensity * 0.6,
                          filter: `brightness(${0.6 + flameIntensity * 0.4})`,
                        }}
                      />
                      {/* Flame glow for intense days */}
                      {isLargeFlame && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            boxShadow: `0 0 ${6 + flameIntensity * 8}px rgba(245, 158, 11, ${0.2 + flameIntensity * 0.3})`,
                          }}
                        />
                      )}
                    </motion.div>
                  ) : (
                    <span className="text-[10px]">{day.date.getDate()}</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
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
