"use client";

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
}

interface RoadmapProps {
  modules: RoadmapModule[];
  completedCount: number;
  className?: string;
}

export function Roadmap({ modules, completedCount, className }: RoadmapProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Дорожная карта</h3>
        <span className="text-[11px] text-muted-foreground">
          {completedCount} из {modules.length} модулей
        </span>
      </div>

      <div className="flex-1 flex items-center">
        <div className="flex items-center gap-0 w-full px-2 overflow-x-auto">
          {modules.map((mod, idx) => (
            <div key={mod.id} className="flex items-center" style={{ flex: idx < modules.length - 1 ? 1 : "none" }}>
              {/* Node with tooltip */}
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "roadmap-node shrink-0 cursor-pointer",
                      mod.status === "completed" &&
                        "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30",
                      mod.status === "current" &&
                        "bg-emerald-500/30 text-emerald-300 border-2 border-emerald-400 pulse-ring",
                      mod.status === "locked" &&
                        "bg-white/5 text-muted-foreground border-2 border-white/10"
                    )}
                    style={mod.status === "current" ? { zIndex: 1 } : undefined}
                  >
                    {mod.status === "locked" && mod.number > 9 ? (
                      <span className="text-[10px]">···</span>
                    ) : (
                      mod.number
                    )}
                  </div>
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
              {idx < modules.length - 1 && (
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
