"use client";

import { useCallback } from "react";
import { HelpCircle } from "lucide-react";
import { useGlossaryOpen } from "./glossary-command";

export function GlossaryTrigger() {
  const openGlossary = useGlossaryOpen();

  const handleClick = useCallback(() => {
    if (openGlossary) {
      openGlossary();
    }
  }, [openGlossary]);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        className="flex h-10 w-10 items-center justify-center rounded-full glass glass-hover shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 group"
        aria-label="Открыть глоссарий (Ctrl+K)"
        title="Глоссарий — Ctrl+K / Ctrl+Л"
      >
        <HelpIcon className="h-5 w-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
      </button>
      <span className="text-[8px] text-muted-foreground/40 font-mono leading-none">Ctrl+K</span>
    </div>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return <HelpCircle className={className} />;
}
