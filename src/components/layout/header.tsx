"use client";

import { useUserStore } from "@/store/user-store";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { Button } from "@/components/ui/button";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { AnimatedNumber } from "@/components/gamification/animated-number";
import { Menu } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const { xp, level, streak, name, image, role, id: userId } = useUserStore();
  const [hovered, setHovered] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground hover:text-foreground"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* XP Bar - main area */}
      <div className="flex flex-1 items-center gap-4">
        <XPBar currentXp={xp} level={level} className="hidden sm:flex max-w-xs" compact />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle size="small" />
        <StreakCounter streak={streak} />

        {session ? (
          <Link
            href={userId ? `/profile/${userId}` : "/dashboard"}
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* Avatar — scales up on hover */}
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: hovered ? "scale(1.12)" : "scale(1)" }}
            >
              <AvatarFrame level={level} image={image} name={name} size="sm" role={role} />
            </div>

            {/* Hover tooltip — XP & level */}
            {hovered && (
              <div className="absolute top-full right-0 mt-2 z-50 pointer-events-none">
                <div className="glass rounded-lg px-3 py-2 border border-white/10 shadow-xl whitespace-nowrap">
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Уровень {level} • <AnimatedNumber value={xp} /> XP
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
