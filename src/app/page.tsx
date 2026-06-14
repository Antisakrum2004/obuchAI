"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen animated-gradient overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-sm font-bold gradient-text">Вайб-Кодинг</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 md:px-12 md:py-32 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            <span className="gradient-text">Обучающая платформа</span>
            <br />
            для вайб-кодинга 1С-разработчиков
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Ежедневные задачи по промпт-инженерингу, AI-агентам, Cursor, Claude Code и
            другим AI-инструментам. Прокачай навыки в формате Duolingo.
          </p>

          <div className="flex items-center justify-center">
            <Link href="/login">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-2 text-base"
              >
                <Zap className="mr-2 h-4 w-4" />
                Начать обучение
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 md:px-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-muted-foreground">Вайб-Кодинг</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              Админка
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
