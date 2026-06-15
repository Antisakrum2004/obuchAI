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
  GraduationCap,
  Award,
  BookOpen,
  Archive,
  Map,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.35.9";

/**
 * Navigation items for all users.
 * Order: Главная → Обучение → Задачи → Рейтинг → Ачивки → Академия
 *
 * "База знаний" (knowledge) is adminOnly — regular users access
 * learning content through "Обучение" (course-map) instead.
 */
const userNavItems = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/knowledge/course-map", label: "Обучение", icon: Map },
  { href: "/challenges", label: "Задачи", icon: Target },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
  { href: "/achievements", label: "Ачивки", icon: Award },
  { href: "/about", label: "Академия", icon: GraduationCap },
];

/**
 * Admin-only navigation items — shown at the bottom of the list.
 * These are special management tabs only accessible to ADMIN role.
 */
const adminNavItems = [
  { href: "/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/knowledge/materials", label: "Материалы", icon: Archive },
  { href: "/admin", label: "Управление", icon: Settings },
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

  // Merge nav items: user items first, admin items appended if admin
  const navItems = isAdmin ? [...userNavItems, ...adminNavItems] : userNavItems;

  return (
    <div className={cn("flex h-full flex-col items-center", className)}>
      {/* Logo */}
      <div className="flex items-center justify-center py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 cursor-pointer">
          <Zap className="h-6 w-6 text-emerald-400" />
        </div>
      </div>

      {/* Navigation — icon-only with tooltips */}
      <nav className="flex-1 flex flex-col items-center gap-6 py-4 w-full px-3">
        {navItems.map((item) => {
          const isExactMatch = pathname === item.href;
          const isPrefixMatch = pathname.startsWith(item.href + "/");
          // Special case: "/knowledge" should only highlight on exact match (not sub-routes)
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
              <item.icon className={cn("h-6 w-6", isActive && "text-emerald-400")} />
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
