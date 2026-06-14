"use client";

import { useUserStore } from "@/store/user-store";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { Button } from "@/components/ui/button";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { AnimatedNumber } from "@/components/gamification/animated-number";
import { Menu, Flame, Shield } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";
import { getGradeName, getGradeColor } from "@/lib/gamification";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuToggle?: () => void;
}

/** Grade badge styling */
function getGradeBadgeClass(level: number): string {
  if (level >= 25) return "bg-rose-500/15 text-rose-400";
  if (level >= 20) return "bg-yellow-500/15 text-yellow-400";
  if (level >= 15) return "bg-amber-500/15 text-amber-400";
  if (level >= 10) return "bg-purple-500/15 text-purple-400";
  if (level >= 5) return "bg-blue-500/15 text-blue-400";
  return "bg-emerald-500/15 text-emerald-400";
}

export function Header({ onMenuToggle }: HeaderProps) {
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const { xp, level, streak, name, image, role, id: userId, difficultyBoost } = useUserStore();
  const [hovered, setHovered] = useState(false);

  const gradeName = getGradeName(level);
  const gradeBadgeClass = getGradeBadgeClass(level);

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground hover:text-foreground"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Grade badge + XP Bar */}
      <div className="flex items-center gap-3 flex-1">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap", gradeBadgeClass)}>
          {gradeName}
        </span>
        <XPBar currentXp={xp} level={level} className="hidden sm:flex max-w-xs" compact />
        <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">
          Уровень {level}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <StreakCounter streak={streak} />
        {difficultyBoost && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
              difficultyBoost === "harder"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                : "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
            )}
            title={difficultyBoost === "harder" ? "Разогрев: сложность повышена" : "Поддержка: сложность понижена"}
          >
            {difficultyBoost === "harder" ? (
              <>
                <Flame className="h-3 w-3" />
                Разогрев
              </>
            ) : (
              <>
                <Shield className="h-3 w-3" />
                Поддержка
              </>
            )}
          </span>
        )}
        <HeartsDisplay hearts={3} />
        <ThemeToggle size="small" />

        {session ? (
          <Link
            href={userId ? `/profile/${userId}` : "/dashboard"}
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: hovered ? "scale(1.12)" : "scale(1)" }}
            >
              <AvatarFrame level={level} image={image} name={name} size="sm" role={role} />
            </div>

            {hovered && (
              <div className="absolute top-full right-0 mt-2 z-50 pointer-events-none">
                <div className="glass rounded-lg px-3 py-2 border border-white/10 shadow-xl whitespace-nowrap">
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Уровень {level} · <AnimatedNumber value={xp} /> XP
                  </p>
                </div>
              </div>
            )}
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => signIn()}
          >
            Войти
          </Button>
        )}
      </div>
    </header>
  );
}
