"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { GraduationCap, Clock, Zap, ArrowRight, Sparkles, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PhilippovCourseCard — карточка «Платные курсы» на Dashboard.
 * Секция «Рекомендуемый курс» с акцентным purple-стилем.
 * Динамически подтягивает количество видеоуроков с медиа-сервера.
 */
export function PhilippovCourseCard() {
  const [videoCount, setVideoCount] = useState<number>(0);

  useEffect(() => {
    fetch("/api/video/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.files && Array.isArray(data.files)) {
          setVideoCount(data.files.length);
        }
      })
      .catch(() => {});
  }, []);

  const lessonLabel = videoCount > 0
    ? `${videoCount} ${pluralize(videoCount, "урок", "урока", "уроков")}`
    : "Загрузка...";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      className="relative overflow-hidden rounded-2xl border border-purple-500/50 bg-gradient-to-br from-slate-900 to-purple-950 p-5"
    >
      {/* Decorative glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-4">
        {/* Icon */}
        <div className="shrink-0 flex items-start">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <GraduationCap className="h-7 w-7 text-purple-300" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
              Рекомендуемый курс
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mb-1.5">
            Платные курсы
          </h3>

          <p className="text-sm text-purple-200/70 leading-relaxed mb-3">
            Практический курс по интеграции AI в 1С-разработку.
            Реальные кейсы автоматизации, промпт-инжиниринг и генерация кода
            — от основ до продвинутых техник.
          </p>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/25">
              <MonitorPlay className="h-3 w-3" />
              {lessonLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-purple-200/70 border border-white/10">
              <Sparkles className="h-3 w-3" />
              AI для 1С
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <Zap className="h-3 w-3" />
              +50 XP
            </span>
          </div>

          {/* CTA */}
          <Link href="/knowledge/local-videos">
            <Button
              size="sm"
              className="bg-purple-500/25 text-purple-200 border border-purple-500/40 hover:bg-purple-500/40 hover:text-white transition-all duration-200"
            >
              Начать обучение
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}
