"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, Target, Trophy, TreePine, Flame, ChevronRight, Sparkles, Shield } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Target,
    title: "Ежедневные задачи",
    description: "Каждый день — новый вызов. Прокачивай навыки работы с AI регулярно.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: TreePine,
    title: "Дерево навыков",
    description: "10 категорий: от промптинга до AI для 1С. Прогресс по каждой.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Trophy,
    title: "Рейтинг и достижения",
    description: "Соревнуйся с другими, зарабатывай достижения и поднимайся в топ.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Flame,
    title: "Серия дней",
    description: "Поддерживай серию ежедневных занятий и получай бонусный XP.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen animated-gradient overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-sm font-bold gradient-text">AI Тренажёр</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Демо
            </Button>
          </Link>
          <Link href="/login">
            <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
              Начать
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 md:px-12 md:py-32 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400 mb-6">
            <Sparkles className="h-4 w-4" />
            Бесплатная платформа
          </div>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            <span className="gradient-text">AI Тренажёр</span>
            <br />
            для 1C разработчиков
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Ежедневные задачи по промпт-инженерингу, AI-агентам, Cursor, Claude Code и
            другим AI-инструментам. Прокачай навыки в формате Duolingo.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-lg h-14 px-8 glow-emerald"
              >
                <Zap className="mr-2 h-5 w-5" />
                Начать обучение
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="lg"
                className="border-white/10 hover:bg-white/5 text-lg h-14 px-8"
              >
                Попробовать демо
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 md:px-12 md:py-24 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="glass rounded-xl p-6 hover:bg-white/[0.07] transition-all duration-200"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${feature.bgColor} mb-4`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 md:px-12 md:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass rounded-2xl p-8 md:p-12 max-w-2xl mx-auto"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Готов прокачать <span className="gradient-text">AI-навыки</span>?
          </h2>
          <p className="text-muted-foreground mb-6">
            Присоединяйся к сообществу 1C разработчиков, которые уже используют AI
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-12 px-8"
            >
              Начать бесплатно
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 md:px-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-muted-foreground">AI Тренажёр для 1C</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              Админка
            </Link>
            <p className="text-xs text-muted-foreground">© 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
