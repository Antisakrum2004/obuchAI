"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Zap, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChallengeCardProps {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  completed?: boolean;
  isSolved?: boolean;
  cooldownUntil?: string | null;
  className?: string;
}

function formatCooldown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes} мин`;
}

export function ChallengeCard({
  id,
  title,
  description,
  difficulty,
  type,
  category,
  xpReward,
  completed,
  isSolved,
  cooldownUntil,
  className,
}: ChallengeCardProps) {
  const solved = isSolved || completed;
  const onCooldown = cooldownUntil && new Date(cooldownUntil) > new Date();
  const cooldownText = onCooldown ? formatCooldown(cooldownUntil!) : null;

  return (
    <Link href={`/challenges/${id}`}>
      <div
        className={cn(
          "group glass rounded-xl p-4 transition-all duration-200 cursor-pointer",
          solved
            ? "opacity-50 hover:opacity-70 border-emerald-500/10"
            : onCooldown
            ? "opacity-60 hover:opacity-75 border-amber-500/10"
            : "hover:bg-white/[0.07]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm">{categoryEmoji(category)}</span>
              <Badge variant="outline" className={difficultyBadgeClass(difficulty)}>
                {difficultyLabel(difficulty)}
              </Badge>
              <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10 text-xs">
                {typeLabel(type)}
              </Badge>
              {solved && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Решено
                </Badge>
              )}
              {onCooldown && !solved && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  <Clock className="mr-1 h-3 w-3" />
                  Через {cooldownText}
                </Badge>
              )}
            </div>
            <h3 className={cn(
              "font-semibold mb-1 transition-colors line-clamp-1",
              solved ? "text-muted-foreground" : "group-hover:text-emerald-400"
            )}>
              {title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={cn(
              "flex items-center gap-1",
              solved ? "text-muted-foreground/50" : "text-emerald-400"
            )}>
              <Zap className="h-3.5 w-3.5" />
              <span className={cn("text-xs font-semibold", solved && "line-through")}>+{xpReward}</span>
            </div>
            <ChevronRight className={cn(
              "h-4 w-4 transition-colors",
              solved ? "text-muted-foreground/30" : "text-muted-foreground group-hover:text-emerald-400"
            )} />
          </div>
        </div>
      </div>
    </Link>
  );
}
