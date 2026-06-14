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
import { useSession } from "next-auth/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.24.3";

const allNavItems = [
  { href: "/dashboard", label: "Главная", icon: Home, adminOnly: false },
  { href: "/challenges", label: "Задачи", icon: Target, adminOnly: false },
  { href: "/marathon", label: "Марафон", icon: Flame, adminOnly: false },
  { href: "/knowledge/materials", label: "Материалы", icon: Archive, adminOnly: true },
  { href: "/knowledge", label: "База знаний", icon: BookOpen, adminOnly: false },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy, adminOnly: false },
  { href: "/achievements", label: "Ачивки", icon: Award, adminOnly: false },
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
  const isAdmin = session?.user?.role === "admin";
  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={cn("flex h-full flex-col items-center", className)}>
      {/* Logo */}
      <div className="flex items-center justify-center py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 cursor-pointer">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {/* Navigation — icon-only with tooltips */}
      <nav className="flex-1 flex flex-col items-center gap-2 py-4 w-full px-3">
        {navItems.map((item) => {
          const isExactMatch = pathname === item.href;
          const isPrefixMatch = pathname.startsWith(item.href + "/");
          const isActive = item.href === "/knowledge" ? isExactMatch : (isExactMatch || isPrefixMatch);

          const iconButton = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "sidebar-icon w-full flex items-center justify-center",
                isActive
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-emerald-400")} />
            </Link>
          );

          return (
            <Tooltip key={item.href} delayDuration={200}>
              <TooltipTrigger asChild>{iconButton}</TooltipTrigger>
              <TooltipContent side="right" className="bg-card border-border text-foreground">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer — version */}
      <div className="py-3">
        <p className="text-[9px] text-muted-foreground/50 text-center">v{APP_VERSION}</p>
      </div>
    </div>
  );
}
