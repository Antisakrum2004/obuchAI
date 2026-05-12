"use client";

import { useUserStore } from "@/store/user-store";
import { XPBar } from "@/components/gamification/xp-bar";
import { StreakCounter } from "@/components/gamification/streak-counter";
import { LevelBadge } from "@/components/gamification/level-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const { xp, level, streak, name, image } = useUserStore();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-white/5 bg-[#0a0a0f]/80 px-4 backdrop-blur-md md:px-6">
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
        <LevelBadge level={level} />
        <XPBar currentXp={xp} level={level} className="hidden sm:flex max-w-xs" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <StreakCounter streak={streak} />

        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border border-white/10">
                  <AvatarImage src={image || undefined} alt={name || ""} />
                  <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-sm">
                    {name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#111118] border-white/10">
              <div className="flex items-center gap-2 p-2">
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Уровень {level} • {xp} XP
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Профиль
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
