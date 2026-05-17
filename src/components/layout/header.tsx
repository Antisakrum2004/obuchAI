"use client";

import { useUserStore } from "@/store/user-store";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { Button } from "@/components/ui/button";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { AnimatedNumber } from "@/components/gamification/animated-number";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User, Info } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const { xp, level, streak, name, image, role, id: userId } = useUserStore();

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-auto w-auto rounded-full p-0">
                <AvatarFrame level={level} image={image} name={name} size="sm" role={role} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <div className="flex items-center gap-2 p-2">
                <AvatarFrame level={level} image={image} name={name} size="sm" role={role} />
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Уровень {level} • <AnimatedNumber value={xp} /> XP
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem asChild>
                <Link href={userId ? `/profile/${userId}` : "/dashboard"} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Профиль
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/about" className="cursor-pointer">
                  <Info className="mr-2 h-4 w-4" />
                  О проекте
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
