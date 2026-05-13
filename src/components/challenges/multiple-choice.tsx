"use client";

import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface MultipleChoiceProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function MultipleChoice({
  options,
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
      {options.map((option, index) => (
        <div
          key={index}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-white/5 p-4 transition-all duration-200",
            value === String(index)
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "hover:bg-white/5 hover:border-white/10"
          )}
        >
          <RadioGroupItem
            value={String(index)}
            id={`option-${index}`}
            className="mt-0.5 border-white/20 text-emerald-400"
          />
          <Label
            htmlFor={`option-${index}`}
            className="flex-1 cursor-pointer text-sm leading-relaxed"
          >
            {option}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
