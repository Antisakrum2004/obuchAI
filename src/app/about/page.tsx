"use client";

import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Code2,
  Target,
  Map,
  MessageCircle,
  ChevronRight,
  Trophy,
  Flame,
  Shield,
  Star,
  Award,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Grade data ──────────────────────────────────────────────────

const grades = [
  { range: "1–4",  name: "Начинающий", color: "emerald", bgClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", barClass: "bg-emerald-500" },
  { range: "5–9",  name: "Специалист", color: "blue",    bgClass: "bg-blue-500/15 text-blue-400 border-blue-500/25",       barClass: "bg-blue-500" },
  { range: "10–14", name: "Мастер",    color: "purple",  bgClass: "bg-purple-500/15 text-purple-400 border-purple-500/25",  barClass: "bg-purple-500" },
  { range: "15–19", name: "Про",       color: "amber",   bgClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",    barClass: "bg-amber-500" },
  { range: "20–24", name: "Звезда",    color: "yellow",  bgClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",  barClass: "bg-yellow-500" },
  { range: "25+",   name: "Легенда",   color: "rose",    bgClass: "bg-rose-500/15 text-rose-400 border-rose-500/25",        barClass: "bg-rose-500" },
];

// ── Mastery path steps ──────────────────────────────────────────

const masterySteps = [
  {
    icon: BookOpen,
    title: "Конспект",
    description: "Изучите теорию — каждый урок содержит структурированный материал по теме. Читайте, смотрите видео, отмечайте ключевые концепции. Конспект — это фундамент: без него квиз покажется набором случайных вопросов, а практика — непонятной задачей.",
    color: "text-blue-400",
    iconBg: "bg-blue-500/15",
  },
  {
    icon: ClipboardList,
    title: "Квиз",
    description: "Проверьте понимание — после конспекта вас ждут вопросы с подвохом. Квиз не проверяет память, он проверяет, поняли ли вы суть. Ошиблись — это нормально, но каждое сердце на счету. Отвечайте осознанно, а не наугад.",
    color: "text-amber-400",
    iconBg: "bg-amber-500/15",
  },
  {
    icon: Code2,
    title: "Практика",
    description: "Закрепите навык — практическое задание требует применить знания в реальном сценарии. Здесь нет вариантов ответа: вы формулируете решение сами. Именно практика превращает знание в навык, который вы используете в работе.",
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
  },
];

// ── Interface tips ──────────────────────────────────────────────

const interfaceTips = [
  { icon: Target, label: "Задачи", href: "/challenges", description: "Ежедневные задачи по промптингу, агентам и инструментам. Каждая — конкретный навык, а не абстрактная теория. Начните с них, если хотите практиковаться каждый день." },
  { icon: Map, label: "Обучение", href: "/knowledge/course-map", description: "Карта курса с модулями от простого к сложному. Выбирайте тему, проходите уроки последовательно. Система запоминает ваш прогресс и подскажет, где остановились." },
  { icon: MessageCircle, label: "Помощь", href: null, description: "Кнопка чата с ментором в правом нижнем углу экрана. Задайте вопрос по материалу — ментор поможет разобраться. Доступно на любой странице." },
];

// ── Component ───────────────────────────────────────────────────

export default function AcademyPage() {
  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 glow-emerald">
            <GraduationCap className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Академия</h1>
            <p className="text-sm text-muted-foreground">Как устроена платформа и как прокачаться быстрее всего</p>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* БЛОК 1: Путь к мастерству */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6"
      >
        <Card className="glass border-white/10 bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-emerald-400" />
              Путь к мастерству
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Каждый урок на платформе построен по трёхшаговой модели. Пропускать шаги можно, но мы не рекомендуем — каждый этап усиливает предыдущий. Конспект закладывает основу, квиз проверяет понимание, а практика закрепляет навык навсегда.
            </p>

            <div className="space-y-4">
              {masterySteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-4 items-start">
                    {/* Step number + icon */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", step.iconBg)}>
                        <Icon className={cn("h-5 w-5", step.color)} />
                      </div>
                      {idx < masterySteps.length - 1 && (
                        <div className="w-px h-6 bg-white/10" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-muted-foreground/60">ШАГ {idx + 1}</span>
                        <h3 className={cn("text-sm font-bold", step.color)}>{step.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* БЛОК 2: Система грейдов */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-6"
      >
        <Card className="glass border-white/10 bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-400" />
              Система грейдов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Ваш уровень определяется суммой накопленного XP. Каждый грейд открывает новый цвет прогресс-бара и статус в профиле. Формула расчёта XP для уровня: 100 × уровень<sup>1.5</sup>. Первые уровни даются быстро, но потом придётся постараться.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {grades.map((grade) => (
                <div
                  key={grade.range}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center transition-all hover:scale-[1.02]",
                    grade.bgClass
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <span className="text-lg font-black tabular-nums">{grade.range}</span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/5 mb-2 overflow-hidden">
                    <div className={cn("h-full rounded-full", grade.barClass)} style={{ width: "60%" }} />
                  </div>
                  <p className="text-xs font-bold">{grade.name}</p>
                </div>
              ))}
            </div>

            {/* XP breakdown */}
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <h4 className="text-xs font-bold text-muted-foreground mb-2">Сколько XP дают задачи</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-emerald-500/10 py-1.5">
                  <p className="font-bold text-emerald-400">Лёгкая</p>
                  <p className="text-muted-foreground">25 XP</p>
                </div>
                <div className="rounded-md bg-amber-500/10 py-1.5">
                  <p className="font-bold text-amber-400">Средняя</p>
                  <p className="text-muted-foreground">50 XP</p>
                </div>
                <div className="rounded-md bg-red-500/10 py-1.5">
                  <p className="font-bold text-red-400">Сложная</p>
                  <p className="text-muted-foreground">100 XP</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                Скорость решения влияет: до 30 сек = 100% XP, далее -10% за каждые 30 сек (мин. 10%)
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* БЛОК 3: Интерфейс — где что искать */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-6"
      >
        <Card className="glass border-white/10 bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-blue-400" />
              Интерфейс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Все основные разделы доступны через боковую панель слева. Наведите на иконку, чтобы увидеть название раздела. Вот три ключевых места, с которых стоит начать:
            </p>

            <div className="space-y-3">
              {interfaceTips.map((tip) => {
                const Icon = tip.icon;
                const content = (
                  <div
                    key={tip.label}
                    className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                      <Icon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-bold text-foreground">{tip.label}</h4>
                        {tip.href && (
                          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {tip.description}
                      </p>
                    </div>
                  </div>
                );

                if (tip.href) {
                  return (
                    <Link key={tip.label} href={tip.href} className="block">
                      {content}
                    </Link>
                  );
                }
                return <div key={tip.label}>{content}</div>;
              })}
            </div>

            {/* Quick reference */}
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-orange-400" />
                Быстрая шпаргалка
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Жизни</span>
                  <span className="font-semibold">3 сердца</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Восст.</span>
                  <span className="font-semibold">1 / 30 мин</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Кулдаун</span>
                  <span className="font-semibold">4 ч / задача</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Без жизней</span>
                  <span className="font-semibold text-red-400">XP × 0.5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Стрик горит</span>
                  <span className="font-semibold">через 48 ч</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Бонус стрик</span>
                  <span className="font-semibold text-amber-400">+200/+1000</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="flex justify-center"
      >
        <Link href="/knowledge/course-map">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
            <GraduationCap className="h-4 w-4" />
            Начать обучение
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
