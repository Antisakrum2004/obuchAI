"use client";

import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { useState } from "react";

interface OrderingChallengeProps {
  items: string[];
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
  hints?: string[];
  className?: string;
}

export function OrderingChallenge({
  items,
  value,
  onChange,
  disabled = false,
  hints,
  className,
}: OrderingChallengeProps) {
  const [showHints, setShowHints] = useState(false);
  const order = value.length > 0 ? value : items.map((_, i) => i);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onChange(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onChange(newOrder);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground mb-2">
        Расставьте элементы в правильном порядке (сверху вниз):
      </p>

      <div className="space-y-2">
        {order.map((itemIndex, position) => (
          <div
            key={itemIndex}
            className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
              {position + 1}
            </div>
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{items[itemIndex]}</span>
            {!disabled && (
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => moveUp(position)}
                  disabled={position === 0}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => moveDown(position)}
                  disabled={position === order.length - 1}
                >
                  ↓
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {hints && hints.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-400 hover:text-amber-300"
            onClick={() => setShowHints(!showHints)}
          >
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            Подсказка
          </Button>

          {showHints && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-400 mb-2 font-medium">Подсказки:</p>
              <ul className="space-y-1">
                {hints.map((hint, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    • {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
