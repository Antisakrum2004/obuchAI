"use client";

import { cn } from "@/lib/utils";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";

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

  // Build a map: itemIndex -> assigned position (1-based)
  const assignedPositions = new Map<number, number>();
  value.forEach((itemIndex, pos) => {
    assignedPositions.set(itemIndex, pos + 1);
  });

  const allAssigned = value.length === items.length;

  const handleTap = useCallback(
    (itemIndex: number) => {
      if (disabled) return;

      const currentPos = assignedPositions.get(itemIndex);

      if (currentPos !== undefined) {
        // Already assigned → deselect: remove it and renumber everything after it
        const newOrder = value.filter((idx) => idx !== itemIndex);
        onChange(newOrder);
      } else {
        // Not assigned → add to end
        const newOrder = [...value, itemIndex];
        onChange(newOrder);
      }
    },
    [value, assignedPositions, onChange, disabled]
  );

  const handleReset = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground mb-2">
        Нажимайте на элементы по порядку, чтобы задать последовательность. Нажмите повторно, чтобы отменить:
      </p>

      {/* Item list — NO framer-motion layout to prevent jumping */}
      <div className="space-y-2">
        {items.map((text, itemIndex) => {
          const pos = assignedPositions.get(itemIndex);
          const isAssigned = pos !== undefined;

          return (
            <button
              key={itemIndex}
              type="button"
              disabled={disabled}
              onClick={() => handleTap(itemIndex)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 w-full text-left transition-colors duration-150",
                disabled && "cursor-default",
                !disabled && "cursor-pointer active:scale-[0.98]",
                isAssigned
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]"
                  : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
              )}
            >
              {/* Circle with number or empty — fixed width to prevent layout shift */}
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-colors duration-150 text-sm font-bold",
                  isAssigned
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-white/20 border border-white/10"
                )}
              >
                {isAssigned ? pos : ""}
              </div>

              {/* Text */}
              <span className={cn(
                "text-sm flex-1 transition-colors duration-150",
                isAssigned ? "text-foreground" : "text-muted-foreground"
              )}>
                {text}
              </span>

              {/* Check icon when assigned — fixed width placeholder */}
              <span
                className={cn(
                  "text-xs shrink-0 w-4 text-center transition-opacity duration-150",
                  isAssigned ? "text-emerald-400 opacity-100" : "opacity-0"
                )}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {/* Status & Reset */}
      {value.length > 0 && (
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-xs",
            allAssigned ? "text-emerald-400" : "text-muted-foreground"
          )}>
            {allAssigned
              ? "✓ Порядок задан — все этапы выбраны"
              : `Выбрано ${value.length} из ${items.length}`
            }
          </p>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleReset}
            >
              Сбросить
            </Button>
          )}
        </div>
      )}

      {/* Hints */}
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
