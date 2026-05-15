"use client";

import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { MobileTabBar } from "./mobile-tab-bar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useUserStats } from "@/hooks/use-user-stats";
import { SessionProvider } from "next-auth/react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  useUserStats();

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-white/5">
          <AppSidebar />
        </aside>

        {/* Mobile Sidebar (still accessible via hamburger for Skills etc.) */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="left"
            className="w-64 border-white/5 bg-[#0d0d14] p-0"
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
      </div>
    </SessionProvider>
  );
}
