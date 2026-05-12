"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { difficultyBadgeClass, difficultyLabel, categoryEmoji, categoryLabel, typeLabel } from "@/lib/gamification";
import { Zap, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ChallengeCardProps {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  completed?: boolean;
  className?: string;
}

export function ChallengeCard({
  id,
  title,
  description,
  difficulty,
  type,
  category,
  xpReward,
  completed = false,
  className,
}: ChallengeCardProps) {
  return (
    <Link href={`/challenges/${id}`}>
      <div
        className={cn(
          "group glass rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.07] cursor-pointer",
          completed && "border-emerald-500/20",
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
              {completed && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Решено
                </Badge>
              )}
            </div>
            <h3 className="font-semibold mb-1 group-hover:text-emerald-400 transition-colors line-clamp-1">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1 text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">+{xpReward}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}
