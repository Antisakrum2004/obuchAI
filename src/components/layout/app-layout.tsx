"use client";

import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { MobileTabBar } from "./mobile-tab-bar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MentorChat } from "@/components/knowledge/mentor-chat";
import { useState } from "react";
import { useUserStats } from "@/hooks/use-user-stats";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  useUserStats();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar — narrow icon-only bar */}
      <aside className="hidden md:flex md:w-[70px] md:min-w-[70px] md:flex-col md:border-r md:border-white/5">
        <AppSidebar />
      </aside>

      {/* Mobile Sidebar (still accessible via hamburger for Skills etc.) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[70px] border-white/5 bg-sidebar p-0"
        >
          <AppSidebar onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSheetOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />

      {/* Mentor Chat — only inside dashboard, not on landing */}
      <MentorChat />
    </div>
  );
}
