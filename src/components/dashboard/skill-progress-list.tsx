"use client";

import { cn } from "@/lib/utils";
import { categoryEmoji, categoryLabel } from "@/lib/gamification";

interface SkillProgressItem {
  id: string;
  name: string;
  category: string;
  xp: number;
  requiredXp: number;
  level: number;
}

interface SkillProgressListProps {
  skills: SkillProgressItem[];
  className?: string;
}

export function SkillProgressList({ skills, className }: SkillProgressListProps) {
  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      <h3 className="font-semibold mb-4">Прогресс навыков</h3>

      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Начните решать задачи!</p>
      ) : (
        <div className="space-y-3">
          {skills.slice(0, 6).map((skill) => {
            const percentage = Math.min((skill.xp / skill.requiredXp) * 100, 100);
            return (
              <div key={skill.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{categoryEmoji(skill.category)}</span>
                    <span className="font-medium">{skill.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {skill.xp}/{skill.requiredXp} XP
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full progress-gradient transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
