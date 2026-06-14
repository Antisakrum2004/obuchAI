"use client";

import { signIn, getProviders } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Zap, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [hasGoogle, setHasGoogle] = useState(false);
  const searchParams = useSearchParams();

  // Handle referral code from URL — store in cookie for the OAuth flow
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      document.cookie = `ref=${refCode}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }, [searchParams]);

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGoogle(!!providers?.google);
    });
  }, []);

  const handleDemoLogin = async () => {
    setIsLoading("demo");
    try {
      await signIn("credentials", {
        email: "demo@ai-trainer.dev",
        redirect: true,
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Demo login error:", error);
      setIsLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading("google");
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Google login error:", error);
      setIsLoading(null);
    }
  };

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

          <div className="space-y-3">
            {/* Google Login */}
            {hasGoogle && (
              <>
                <Button
                  onClick={handleGoogleLogin}
                  disabled={isLoading !== null}
                  variant="outline"
                  className="w-full border-white/10 hover:bg-white/5 h-12"
                >
                  {isLoading === "google" ? (
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Войти через Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">или</span>
                  </div>
                </div>
              </>
            )}

            {/* Demo Login — regular user, NOT admin */}
            <Button
              onClick={handleDemoLogin}
              disabled={isLoading !== null}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-12 btn-bounce"
            >
              {isLoading === "demo" ? (
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
              ) : (
                <Zap className="mr-2 h-5 w-5" />
              )}
              Демо-вход
            </Button>
          </div>

          {!hasGoogle && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-400/80">
                Вход через Google будет доступен после настройки OAuth. Сейчас работает демо-вход.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            Войдите, чтобы сохранять прогресс и зарабатывать XP
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center animated-gradient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
