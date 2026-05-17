"use client";

import { motion } from "framer-motion";
import {
  Heart,
  Zap,
  Trophy,
  Flame,
  Clock,
  Shield,
  Target,
  TreePine,
  FlaskConical,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  TrendingUp,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const sections = [
  {
    icon: Sparkles,
    title: "Что это",
    color: "emerald",
    content: [
      "AI Тренажёр — это Duolingo для 1С-разработчика, который хочет перестать гуглить «как написать промпт» и начать реально использовать ИИ в работе. Промптинг, агенты, RAG, Cursor, Claude Code, MCP — всё это уже не модные слова, а инструменты, которые нужно осваивать. И мы делаем это через короткие задачи с подковырками, а не через многочасовые курсы, которые никто не досматривает.",
      "Каждая задача — это конкретный навык. Не «изучите RAG», а «какой промпт вернёт нужный документ из базы?». Вы не читаете теорию — вы решаете. И если ошибаетесь — это не конец, а часть процесса. Главное — не сдаваться.",
    ],
  },
  {
    icon: Target,
    title: "Что внутри",
    color: "blue",
    items: [
      { emoji: "✍️", label: "Промптинг", desc: "Формулируй запросы так, чтобы ИИ понимал с полуслова" },
      { emoji: "🤖", label: "AI Агенты", desc: "Автономные помощники: когда нужен агент, а когда — просто промпт" },
      { emoji: "🛠️", label: "Инструменты", desc: "Cursor, Claude Code, MCP, OpenAI API — разбор полётов" },
      { emoji: "⚡", label: "Автоматизация", desc: "RAG, пайплайны, интеграции — делегируй рутину машине" },
      { emoji: "🖥️", label: "1С", desc: "Специфика 1С + ИИ: от отладки до генерации кода" },
      { emoji: "🔍", label: "Дебаггинг", desc: "Найди ошибку в промпте, агенте или workflow" },
      { emoji: "🔄", label: "Workflow", desc: "Собери правильную последовательность действий" },
      { emoji: "👀", label: "Ревью", desc: "Оцени чужой промпт — найди ловушки и слабые места" },
    ],
  },
  {
    icon: Heart,
    title: "Жизни (они же сердца)",
    color: "red",
    content: [
      "У тебя 3 жизни. Каждая ошибка — минус сердце. Жизни не сгорают от времени — они тратятся только на неверные ответы. Когда все 3 сердца потеряны, ты не выбываешь из игры: можно продолжать решать задачи, но XP начисляется в два раза меньше. Обидно, но справедливо.",
      "Жизни восстанавливаются автоматически — одно сердце каждые 30 минут. Не нужно ничего нажимать, просто подожди. Таймер покажет, когда придёт следующее сердце. Так что даже если ты промахнулся трижды подряд — это не фиаско, а тайм-аут на чашку кофе.",
    ],
  },
  {
    icon: Clock,
    title: "Кулдаун (остывание)",
    color: "amber",
    content: [
      "Ошибся на конкретной задаче — получаешь 4 часа кулдауна на неё. В это время задача недоступна. Это не наказание, а защита от спама: не пытайся угадать ответ перебором, лучше подумай и вернись позже с свежей головой.",
      "Кулдаун привязан к конкретной задаче. Все остальные задачи остаются доступны — можно переключиться и продолжать зарабатывать XP. Таймер виден в списке задач: заблокированные показываются с обратным отсчётом.",
    ],
  },
  {
    icon: Zap,
    title: "XP и уровни",
    color: "yellow",
    content: [
      "Каждый правильный ответ приносит XP. Сколько — зависит от сложности: лёгкая задача даёт 25 XP, средняя — 50, сложная — 100. Но это ещё не всё. Если решил быстро (до 30 секунд) — получаешь 100% XP. Каждый лишний 30-секундный интервал снимает 10%. Минимум — 10% от базового XP. Так что скорость имеет значение, но и через 5 минут размышлений ты всё равно получишь хоть что-то.",
      "Без жизней XP режется пополам. Так что береги сердца — они напрямую влияют на твой прогресс. Уровни растут по формуле 100 × уровень^1.5 — первые уровни быстрые, дальше придётся попотеть.",
    ],
  },
  {
    icon: Flame,
    title: "Стрик (серия дней)",
    color: "orange",
    content: [
      "Решаешь каждый день — копишь стрик. Это не просто цифра для гордости: на 7-й день подряд получаешь бонус 200 XP, на 30-й — 1000 XP. Сгорает стрик, если не заходишь 48 часов. Не дней, а часов — то есть даже через день-два без активности серия обнулится. Лучше решать хотя бы одну задачу в день, чем потерять месячный стрик.",
    ],
  },
  {
    icon: TrendingUp,
    title: "Навыки",
    color: "purple",
    content: [
      "10 навыков — от основ промптинга до продвинутой автоматизации. Каждый решённый вопрос прокачивает соответствующий навык. Дерево навыков показывает, где ты силён, а где есть пробелы. Чем выше уровень навыка — тем сложнее задачи в этой категории тебе доступны.",
    ],
  },
  {
    icon: Star,
    title: "Достижения",
    color: "cyan",
    content: [
      "16 достижений за разные подвиги: стрики, количество задач, уровень навыков, особые условия. Некоторые открываются сами — просто играй. Другие потребуют целенаправленных усилий. Собери все, если хватит упорства.",
    ],
  },
  {
    icon: FlaskConical,
    title: "Песочница",
    color: "teal",
    content: [
      "Отдельный раздел с шаблонами промптов, примерами «хороший vs плохой» и разборами workflow. Можно изучать без давления таймера и жизней — просто читай, сравнивай, запоминай.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Задачи с подковырками",
    color: "rose",
    content: [
      "Задачи не очевидные. Ответ не угадается по длине или размеру варианта. Ловушки спрятаны в формулировках, вариантах ответа и порядке действий. Односложные очевидные ответы исключены — правильный вариант всегда требует думать. Если кажется слишком простым — скорее всего, это ловушка.",
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; glow: string; iconBg: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", glow: "shadow-emerald-500/10", iconBg: "bg-emerald-500/20" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", glow: "shadow-blue-500/10", iconBg: "bg-blue-500/20" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", glow: "shadow-red-500/10", iconBg: "bg-red-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", glow: "shadow-amber-500/10", iconBg: "bg-amber-500/20" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", glow: "shadow-yellow-500/10", iconBg: "bg-yellow-500/20" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", glow: "shadow-orange-500/10", iconBg: "bg-orange-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", glow: "shadow-purple-500/10", iconBg: "bg-purple-500/20" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", glow: "shadow-cyan-500/10", iconBg: "bg-cyan-500/20" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20", glow: "shadow-teal-500/10", iconBg: "bg-teal-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", glow: "shadow-rose-500/10", iconBg: "bg-rose-500/20" },
};

export default function AboutPage() {
  const router = useRouter();

  const handleBack = () => {
    // If there's no navigation history (direct link), default to /dashboard
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push("/dashboard");
    } else {
      router.back();
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground gap-1.5 -ml-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-sm sm:text-xs"
        >
          <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          Назад
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 glow-emerald">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">О проекте</h1>
            <p className="text-sm text-muted-foreground">Мини-инструкция для тех, кто хочет разобраться</p>
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="space-y-5">
        {sections.map((section, idx) => {
          const colors = colorMap[section.color];
          const Icon = section.icon;

          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.iconBg}`}>
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                <h2 className={`text-lg font-bold ${colors.text}`}>{section.title}</h2>
              </div>

              {/* Text content */}
              {section.content && (
                <div className="space-y-3">
                  {section.content.map((paragraph, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {/* Item list content */}
              {section.items && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-start gap-2.5 rounded-lg border ${colors.border} bg-white/[0.02] px-3 py-2.5`}
                    >
                      <span className="text-lg shrink-0 mt-0.5">{item.emoji}</span>
                      <div>
                        <p className={`text-sm font-semibold ${colors.text}`}>{item.label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Quick reference card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: sections.length * 0.06 }}
        className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5"
      >
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          Шпаргалка
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Жизни</p>
            <p className="font-semibold text-foreground">3 сердца</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Восстановление</p>
            <p className="font-semibold text-foreground">1 сердце / 30 мин</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Кулдаун за ошибку</p>
            <p className="font-semibold text-foreground">4 часа на задачу</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Без жизней</p>
            <p className="font-semibold text-red-400">XP × 0.5</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Стрик горит через</p>
            <p className="font-semibold text-foreground">48 часов</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Бонус за 7 / 30 дней</p>
            <p className="font-semibold text-amber-400">+200 / +1000 XP</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Лёгкая / Средняя / Сложная</p>
            <p className="font-semibold text-foreground">25 / 50 / 100 XP</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Скорость = бонус</p>
            <p className="font-semibold text-foreground">100% до 30 сек</p>
          </div>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: sections.length * 0.06 + 0.2 }}
        className="mt-6 flex justify-center"
      >
        <Link href="/challenges">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
            <Target className="h-4 w-4" />
            К задачам
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
