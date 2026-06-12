"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Target,
  Trophy,
  Settings,
  Zap,
  Info,
  Flame,
  Award,
  BookOpen,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

// Read version from package.json at build time
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.16.0";

const allNavItems = [
  { href: "/dashboard", label: "Главная", icon: Home, adminOnly: false },
  { href: "/challenges", label: "Задачи", icon: Target, adminOnly: false },
  { href: "/marathon", label: "Марафон", icon: Flame, adminOnly: false },
  // { href: "/skills", label: "Навыки", icon: TreePine, adminOnly: false }, // removed
  { href: "/knowledge/materials", label: "Материалы", icon: Archive, adminOnly: true },
  { href: "/knowledge", label: "База знаний", icon: BookOpen, adminOnly: false },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy, adminOnly: false },
  { href: "/achievements", label: "Ачивки", icon: Award, adminOnly: false },
  // { href: "/playground", label: "Песочница", icon: FlaskConical, adminOnly: false }, // hidden
  { href: "/about", label: "О проекте", icon: Info, adminOnly: false },
  { href: "/admin", label: "Управление", icon: Settings, adminOnly: true },
];

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const isAdmin = (session?.user as Record<string, unknown>)?.role === "admin";
  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight gradient-text">AI Тренажёр</h1>
          <p className="text-[10px] text-muted-foreground">для 1C разработчиков</p>
        </div>
      </div>

      <Separator className="bg-white/5 mx-3 w-auto" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          // For exact-match routes like /knowledge, only highlight on exact match
          // to avoid both /knowledge and /knowledge/materials being active
          const isExactMatch = pathname === item.href;
          const isPrefixMatch = pathname.startsWith(item.href + "/");
          const isActive = item.href === "/knowledge" ? isExactMatch : (isExactMatch || isPrefixMatch);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive && "text-emerald-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-white/5 mx-3 w-auto" />

      {/* Footer */}
      <div className="px-4 py-4 space-y-3">
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            onClick={onNavigate}
          >
            <Zap className="mr-2 h-4 w-4" />
            Ежедневная задача
          </Button>
        </Link>
        <div className="flex items-center justify-center pt-1">
          <ThemeToggle size="small" />
        </div>
        <p className="text-center text-[10px] text-muted-foreground/50">
          v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
