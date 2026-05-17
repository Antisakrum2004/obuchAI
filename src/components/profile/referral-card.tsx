"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Share2, Gift, Users, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReferralData {
  referralCode: string;
  referralCount: number;
  referredBy: string | null;
  xpFromReferrals: number;
}

interface ReferralCardProps {
  /** Compact mode for dashboard widget */
  compact?: boolean;
}

const REFERRAL_URL_BASE = "https://obuch-ai.vercel.app/login?ref=";

export function ReferralCard({ compact = false }: ReferralCardProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refInput, setRefInput] = useState("");

  useEffect(() => {
    fetch("/api/referral")
      .then((r) => r.json())
      .then((d) => {
        if (d.referralCode) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const referralUrl = data ? `${REFERRAL_URL_BASE}${data.referralCode}` : "";

  const copyLink = useCallback(async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Ссылка скопирована!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }, [referralUrl]);

  const shareLink = useCallback(async () => {
    if (!referralUrl) return;
    const shareData = {
      title: "AI Тренажёр — учись и зарабатывай XP!",
      text: `Присоединяйся к AI Тренажёру! Вводи мой реферальный код ${data?.referralCode} при регистрации и получи +50 XP бонусом! 🚀`,
      url: referralUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyLink();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await copyLink();
      }
    }
  }, [referralUrl, data?.referralCode, copyLink]);

  const applyCode = useCallback(async () => {
    if (!refInput.trim()) return;
    setApplying(true);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: refInput.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "Код применён! +50 XP");
        setRefInput("");
        // Refresh referral data
        const fresh = await fetch("/api/referral");
        const freshData = await fresh.json();
        if (freshData.referralCode) setData(freshData);
      } else {
        toast.error(result.error || "Ошибка применения кода");
      }
    } catch {
      toast.error("Ошибка сервера");
    } finally {
      setApplying(false);
    }
  }, [refInput]);

  if (loading) {
    if (compact) {
      return (
        <div className="glass rounded-xl p-4 animate-pulse">
          <div className="h-4 w-24 bg-white/10 rounded mb-3" />
          <div className="h-8 w-full bg-white/10 rounded mb-2" />
          <div className="h-8 w-full bg-white/10 rounded" />
        </div>
      );
    }
    return (
      <div className="glass rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="h-12 w-full bg-white/10 rounded-lg mb-3" />
        <div className="h-4 w-32 bg-white/10 rounded mb-2" />
        <div className="h-8 w-24 bg-white/10 rounded" />
      </div>
    );
  }

  if (!data) return null;

  // Compact version for dashboard
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="glass rounded-xl p-4 relative overflow-hidden">
          {/* Subtle glow accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Реферальная программа</h3>
            </div>

            {/* Referral code display */}
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 truncate">
                {data.referralCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copyLink}
                className="shrink-0 border-white/10 hover:bg-white/10 h-9 w-9 p-0"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {data.referralCount} рефералов
              </span>
              <span className="flex items-center gap-1">
                <Gift className="h-3 w-3 text-amber-400" />
                +{data.xpFromReferrals} XP
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full version for profile page
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="glass rounded-2xl p-6 relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Gift className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Реферальная программа</h3>
              <p className="text-xs text-muted-foreground">
                Приглашай друзей и получай +50 XP за каждого
              </p>
            </div>
          </div>

          {/* Referral code */}
          <div className="space-y-2 mb-4">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Твой код
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base font-mono text-emerald-400 tracking-wide">
                {data.referralCode}
              </code>
              <Button
                variant="outline"
                onClick={copyLink}
                className="shrink-0 border-white/10 hover:bg-white/10 gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Скопировать ссылку</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Referral URL display */}
          <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-white/3 border border-white/5">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {referralUrl}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mb-5">
            <Button
              onClick={shareLink}
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-400 hover:to-purple-400 text-white font-semibold"
            >
              <Share2 className="h-4 w-4" />
              Поделиться
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {data.referralCount}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Рефералов
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Gift className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-400">
                +{data.xpFromReferrals}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                XP от рефералов
              </p>
            </div>
          </div>

          {/* Apply referral code (only if user doesn't have one yet) */}
          {!data.referredBy && (
            <div className="border-t border-white/5 pt-4">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Есть реферальный код?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="Введи код друга"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCode();
                  }}
                />
                <Button
                  onClick={applyCode}
                  disabled={applying || !refInput.trim()}
                  variant="outline"
                  className="shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-2"
                >
                  {applying ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                  ) : (
                    "Применить"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Already referred badge */}
          {data.referredBy && (
            <div className="border-t border-white/5 pt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Вы уже использовали реферальный код при регистрации
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
