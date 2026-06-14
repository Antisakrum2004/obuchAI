"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface RoadmapModule {
  id: string;
  number: number;
  title: string;
  status: "completed" | "current" | "locked";
  /** Optional URL — if present, node is clickable */
  href?: string | null;
}

interface RoadmapProps {
  modules: RoadmapModule[];
  completedCount: number;
  className?: string;
}

/** Max visible nodes so they fit without horizontal scroll in ~1200px container */
const MAX_VISIBLE = 7;

export function Roadmap({ modules, completedCount, className }: RoadmapProps) {
  const total = modules.length;
  const overflow = total > MAX_VISIBLE;

  let visibleModules: RoadmapModule[];
  let hiddenCount = 0;

  if (!overflow) {
    visibleModules = modules;
  } else {
    const currentIndex = modules.findIndex((m) => m.status === "current");
    const currentIdx = currentIndex === -1 ? completedCount : currentIndex;

    if (currentIdx < MAX_VISIBLE - 1) {
      visibleModules = modules.slice(0, MAX_VISIBLE - 1);
      hiddenCount = total - (MAX_VISIBLE - 1);
    } else {
      const beforeStart = Math.max(0, currentIdx - 1);
      const afterEnd = Math.min(total, currentIdx + 3);
      const slice = modules.slice(beforeStart, afterEnd);
      visibleModules = slice;
      hiddenCount = total - slice.length;
    }
  }

  const showLeadingEllipsis = overflow && visibleModules[0]?.number !== 1;
  const showTrailingEllipsis = overflow && hiddenCount > 0;

  /** Render a single roadmap node — as Link if href exists, as div otherwise */
  const renderNode = (mod: RoadmapModule, extraClass?: string) => {
    const nodeClass = cn(
      "roadmap-node shrink-0",
      mod.status === "locked"
        ? "bg-white/5 text-muted-foreground border-2 border-white/10 cursor-not-allowed"
        : "cursor-pointer",
      mod.status === "completed" &&
        "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30",
      mod.status === "current" &&
        "bg-emerald-500/30 text-emerald-300 border-2 border-emerald-400 pulse-ring",
      extraClass
    );

    const nodeStyle = mod.status === "current" ? { zIndex: 1 } : undefined;

    const inner = (
      <div className={nodeClass} style={nodeStyle}>
        {mod.number}
      </div>
    );

    // Clickable if href exists and not locked
    if (mod.href && mod.status !== "locked") {
      return (
        <Link href={mod.href} className="block">
          {inner}
        </Link>
      );
    }
    return inner;
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Дорожная карта</h3>
        <span className="text-[11px] text-muted-foreground">
          {completedCount} из {total} модулей
        </span>
      </div>

      <div className="flex-1 flex items-center">
        <div className="flex items-center gap-0 w-full px-2">
          {/* Leading ellipsis */}
          {showLeadingEllipsis && (
            <>
              <div className="flex items-center" style={{ flex: 1 }}>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div className="roadmap-node shrink-0 bg-white/5 text-muted-foreground border-2 border-white/10 cursor-default">
                      <span className="text-[10px]">···</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-card border-border text-foreground text-xs">
                    <span>Ещё {visibleModules[0]?.number ? visibleModules[0].number - 1 : 0} модулей</span>
                  </TooltipContent>
                </Tooltip>
                <div className="roadmap-connector bg-white/10" />
              </div>
            </>
          )}

          {visibleModules.map((mod, idx) => (
            <div key={mod.id} className="flex items-center" style={{ flex: idx < visibleModules.length - 1 || showTrailingEllipsis ? 1 : "none" }}>
              {/* Node with tooltip */}
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  {renderNode(mod)}
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-card border-border text-foreground text-xs max-w-[200px]">
                  <span className="font-medium">{mod.title}</span>
                  {mod.status === "completed" && (
                    <span className="ml-1.5 text-emerald-400">✓</span>
                  )}
                  {mod.status === "current" && (
                    <span className="ml-1.5 text-emerald-300 text-[10px]">← текущий</span>
                  )}
                  {mod.status === "locked" && (
                    <span className="ml-1.5 text-muted-foreground text-[10px]">🔒</span>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Connector */}
              {idx < visibleModules.length - 1 && (
                <div
                  className={cn(
                    "roadmap-connector",
                    mod.status === "completed"
                      ? "bg-emerald-500/30"
                      : "bg-white/10"
                  )}
                />
              )}
            </div>
          ))}

          {/* Trailing ellipsis */}
          {showTrailingEllipsis && (
            <>
              <div className="roadmap-connector bg-white/10" />
              <div className="flex items-center" style={{ flex: "none" }}>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div className="roadmap-node shrink-0 bg-white/5 text-muted-foreground border-2 border-white/10 cursor-default">
                      <span className="text-[10px]">···</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-card border-border text-foreground text-xs">
                    <span>Ещё {hiddenCount} модулей</span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Пройдено
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 inline-block" />
          Текущий
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white/10 inline-block" />
          Заблокирован
        </span>
      </div>
    </div>
  );
}
