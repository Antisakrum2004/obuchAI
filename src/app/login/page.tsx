"use client";

import { signIn } from "next-auth";
import { Button } from "@/components/ui/button";
import { Zap, Target, Trophy, TreePine, Flame } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 glow-emerald">
              <Zap className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">AI Тренажёр</h1>
              <p className="text-xs text-muted-foreground">для 1C разработчиков</p>
            </div>
          </div>

          <h2 className="text-center text-lg font-semibold mb-6">Войти в аккаунт</h2>

          {/* Demo Login */}
          <div className="space-y-3">
            <Button
              onClick={() => signIn("credentials", { email: "admin@ai-trainer.dev", callbackUrl: "/dashboard" })}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-12"
            >
              <Zap className="mr-2 h-5 w-5" />
              Демо: Администратор
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a0f] px-2 text-muted-foreground">или</span>
              </div>
            </div>

            <Button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              variant="outline"
              className="w-full border-white/10 hover:bg-white/5 h-12"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Войти через GitHub
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Войдите, чтобы сохранять прогресс и зарабатывать XP
          </p>
        </div>
      </motion.div>
    </div>
  );
}
