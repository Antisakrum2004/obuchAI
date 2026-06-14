"use client";

import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  /** 2D array: weeks[week][day] = activity level 0-4 */
  data?: number[][];
  weeks?: number;
  className?: string;
}

/** Generate plausible random heatmap data */
function generateHeatmapData(weeks: number): number[][] {
  const data: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const recency = w / weeks;
      const isWeekend = d >= 5;
      const rand = Math.random();
      let level: number;
      if (rand < 0.25 * (1 - recency)) level = 0;
      else if (isWeekend && rand < 0.5) level = 0;
      else if (rand < 0.35) level = 1;
      else if (rand < 0.55) level = 2;
      else if (rand < 0.8) level = 3;
      else level = 4;
      // Recent weeks are more active
      if (w >= weeks - 2 && !isWeekend) level = Math.max(level, 2);
      if (w === weeks - 1) level = Math.max(level, 3);
      week.push(level);
    }
    data.push(week);
  }
  return data;
}

const LEVEL_COLORS = [
  "rgba(255,255,255,0.03)",
  "rgba(16,185,129,0.15)",
  "rgba(16,185,129,0.3)",
  "rgba(16,185,129,0.5)",
  "rgba(16,185,129,0.75)",
];

export function ActivityHeatmap({ data: externalData, weeks = 12, className }: ActivityHeatmapProps) {
  const data = externalData ?? generateHeatmapData(weeks);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Активность</h3>
        <span className="text-[11px] text-muted-foreground">Последние {weeks} недель</span>
      </div>
      <div className="flex-1 flex items-end">
        <div className="flex gap-[3px] flex-wrap">
          {data.map((week, wi) =>
            week.map((level, di) => (
              <div
                key={`${wi}-${di}`}
                className="heatmap-cell"
                style={{ background: LEVEL_COLORS[level] ?? LEVEL_COLORS[0] }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
