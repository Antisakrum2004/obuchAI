"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Shield, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("admin-credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Неверный логин или пароль");
      } else {
        router.push("/admin");
      }
    } catch {
      setError("Ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        <div className="glass rounded-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">AI Тренажёр</h1>
              <p className="text-xs text-muted-foreground">Панель администратора</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Логин</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="bg-white/5 border-white/10 h-11"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Пароль</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white/5 border-white/10 h-11"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-11"
            >
              {loading ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Войти в админку
            </Button>
          </form>

          <div className="mt-4 text-center">
            <a
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Обычный вход
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
