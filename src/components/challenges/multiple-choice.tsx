"use client";

import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ShuffledOption {
  originalIndex: number;
  text: string;
}

interface MultipleChoiceProps {
  /** Shuffled options with original index mapping */
  shuffledOptions: ShuffledOption[];
  /** Currently selected ORIGINAL index */
  value: string | null;
  onChange: (originalIndex: string) => void;
  disabled?: boolean;
  className?: string;
}

export function MultipleChoice({
  shuffledOptions,
  value,
  onChange,
  disabled = false,
  className,
}: MultipleChoiceProps) {
  return (
    <RadioGroup
      value={value || ""}
      onValueChange={onChange}
      disabled={disabled}
      className={cn("space-y-3", className)}
    >
      {shuffledOptions.map((option, displayIndex) => (
        <div
          key={option.originalIndex}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-white/5 p-4 transition-all duration-200",
            value === String(option.originalIndex)
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "hover:bg-white/5 hover:border-white/10"
          )}
        >
          <RadioGroupItem
            value={String(option.originalIndex)}
            id={`option-${option.originalIndex}`}
            className="mt-0.5 border-white/20 text-emerald-400"
          />
          <Label
            htmlFor={`option-${option.originalIndex}`}
            className="flex-1 cursor-pointer text-sm leading-relaxed"
          >
            {option.text}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

/**
 * Shuffle options using Fisher-Yates algorithm with a seed.
 * Returns shuffled options with their original index mapping.
 * Using a seeded PRNG so the same user sees consistent order per challenge.
 */
export function shuffleOptions(options: string[], seed: number): ShuffledOption[] {
  const items: ShuffledOption[] = options.map((text, originalIndex) => ({
    originalIndex,
    text,
  }));

  // Seeded PRNG (simple mulberry32)
  let s = seed;
  const random = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Fisher-Yates shuffle with seeded random
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}
