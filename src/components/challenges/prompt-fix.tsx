"use client";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { useState } from "react";

interface PromptFixProps {
  originalPrompt: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hints?: string[];
  className?: string;
}

export function PromptFix({
  originalPrompt,
  value,
  onChange,
  disabled = false,
  hints,
  className,
}: PromptFixProps) {
  const [showHints, setShowHints] = useState(false);
  const charCount = value.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Original prompt display */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-xs text-red-400 mb-2 font-medium">Исходный промпт (плохой):</p>
        <p className="text-sm text-muted-foreground italic">&quot;{originalPrompt}&quot;</p>
      </div>

      {/* Edit area */}
      <div className="space-y-2">
        <p className="text-xs text-emerald-400 font-medium">Улучши промпт:</p>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Напишите улучшенный промпт..."
          className="min-h-[120px] bg-white/5 border-white/10 focus:border-emerald-500/30 resize-y"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{charCount} символов</span>
          {hints && hints.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-400 hover:text-amber-300"
              onClick={() => setShowHints(!showHints)}
            >
              <Lightbulb className="mr-1 h-3.5 w-3.5" />
              Подсказка
            </Button>
          )}
        </div>
      </div>

      {/* Hints */}
      {showHints && hints && (
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
    </div>
  );
}
