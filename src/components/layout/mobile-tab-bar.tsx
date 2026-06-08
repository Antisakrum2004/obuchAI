"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Target, Trophy, Flame, Info, Award } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/challenges", label: "Задачи", icon: Target },
  { href: "/marathon", label: "Марафон", icon: Flame },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
  { href: "/achievements", label: "Ачивки", icon: Award },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/5 bg-[#0a0a0f]/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive
                  ? "text-emerald-400"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <tab.icon
                className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]")}
              />
              <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
        {/* Version indicator */}
        <span className="absolute bottom-1 right-3 text-[8px] text-muted-foreground/30 font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION || "0.5.4"}</span>
      </div>
    </nav>
  );
}
