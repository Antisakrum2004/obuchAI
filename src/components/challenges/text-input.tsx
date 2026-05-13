"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { useState } from "react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hints?: string[];
  className?: string;
}

export function TextInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Введите ответ...",
  hints,
  className,
}: TextInputProps) {
  const [showHints, setShowHints] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="bg-white/5 border-white/10 focus:border-emerald-500/30"
      />

      {hints && hints.length > 0 && (
        <div className="flex items-center justify-between">
          <span />
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-400 hover:text-amber-300"
            onClick={() => setShowHints(!showHints)}
          >
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            Подсказка
          </Button>
        </div>
      )}

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
