"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Lock, X, Star, ChevronRight } from "lucide-react";
import Link from "next/link";
import { categoryEmoji, categoryLabel } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SkillNode {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string | null;
  category: string;
  order: number;
  parentId: string | null;
  requiredXp: number;
  challengeCount: number;
  xp: number;
  level: number;
}

interface SkillTreeProps {
  skills: SkillNode[];
}

/* ------------------------------------------------------------------ */
/*  Category visual config                                             */
/* ------------------------------------------------------------------ */

const categoryColors: Record<
  string,
  { border: string; bg: string; glow: string; accent: string; line: string }
> = {
  prompting: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/15 to-emerald-500/5",
    glow: "shadow-emerald-500/20",
    accent: "text-emerald-400",
    line: "bg-emerald-500/25",
  },
  agents: {
    border: "border-purple-500/30",
    bg: "from-purple-500/15 to-purple-500/5",
    glow: "shadow-purple-500/20",
    accent: "text-purple-400",
    line: "bg-purple-500/25",
  },
  debugging: {
    border: "border-cyan-500/30",
    bg: "from-cyan-500/15 to-cyan-500/5",
    glow: "shadow-cyan-500/20",
    accent: "text-cyan-400",
    line: "bg-cyan-500/25",
  },
  workflow: {
    border: "border-amber-500/30",
    bg: "from-amber-500/15 to-amber-500/5",
    glow: "shadow-amber-500/20",
    accent: "text-amber-400",
    line: "bg-amber-500/25",
  },
  "1c": {
    border: "border-red-500/30",
    bg: "from-red-500/15 to-red-500/5",
    glow: "shadow-red-500/20",
    accent: "text-red-400",
    line: "bg-red-500/25",
  },
  review: {
    border: "border-pink-500/30",
    bg: "from-pink-500/15 to-pink-500/5",
    glow: "shadow-pink-500/20",
    accent: "text-pink-400",
    line: "bg-pink-500/25",
  },
  tools: {
    border: "border-orange-500/30",
    bg: "from-orange-500/15 to-orange-500/5",
    glow: "shadow-orange-500/20",
    accent: "text-orange-400",
    line: "bg-orange-500/25",
  },
  automation: {
    border: "border-amber-500/30",
    bg: "from-amber-500/15 to-amber-500/5",
    glow: "shadow-amber-500/20",
    accent: "text-amber-400",
    line: "bg-amber-500/25",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type SkillStatus = "completed" | "in-progress" | "locked";

function getSkillStatus(skill: SkillNode): SkillStatus {
  const pct = skill.requiredXp > 0 ? (skill.xp / skill.requiredXp) * 100 : 0;
  if (pct >= 100) return "completed";
  if (skill.xp > 0) return "in-progress";
  if (skill.parentId) return "locked";
  if (skill.challengeCount === 0) return "locked";
  return "in-progress";
}

/** Order categories so the six main ones appear first */
const PREFERRED_ORDER = [
  "prompting",
  "agents",
  "debugging",
  "workflow",
  "1c",
  "review",
];

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a);
    const ib = PREFERRED_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/* ------------------------------------------------------------------ */
/*  Skill card (used inside grid columns)                              */
/* ------------------------------------------------------------------ */

function SkillGridCard({
  skill,
  status,
  colors,
  delay,
  isLastInCategory,
}: {
  skill: SkillNode;
  status: SkillStatus;
  colors: (typeof categoryColors)[string];
  delay: number;
  isLastInCategory: boolean;
}) {
  const pct =
    skill.requiredXp > 0
      ? Math.min((skill.xp / skill.requiredXp) * 100, 100)
      : 0;
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={!isLocked ? { scale: 1.03, y: -2 } : undefined}
      whileTap={!isLocked ? { scale: 0.97 } : undefined}
      className={cn(
        "relative cursor-pointer select-none",
        isLocked && "cursor-default"
      )}
    >
      <div
        className={cn(
          "relative rounded-xl p-3 transition-all duration-300 bg-gradient-to-br min-w-0",
          /* completed → bright emerald border + glow */
          isCompleted
            ? "border-2 border-emerald-400/70 shadow-lg shadow-emerald-500/20 " +
                colors.bg
            : /* in-progress → amber border */
              status === "in-progress"
              ? "border-2 border-amber-400/50 " + colors.bg
              : /* locked → gray dashed */
                "border-2 border-dashed border-white/10 bg-white/[0.02] opacity-50 grayscale"
        )}
      >
        {/* Completed star burst */}
        {isCompleted && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        )}

        <div className="relative flex items-center gap-3">
          {/* Icon area */}
          <div className="relative shrink-0">
            {isCompleted ? (
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                <span className="text-lg">{skill.icon || categoryEmoji(skill.category)}</span>
                <div className="absolute -top-1 -right-1">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                </div>
              </div>
            ) : isLocked ? (
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-dashed border-white/15">
                <Lock className="h-4 w-4 text-white/25" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-white/10">
                <span className="text-lg">{skill.icon || categoryEmoji(skill.category)}</span>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "text-sm font-semibold truncate",
                isLocked ? "text-white/30" : "text-foreground"
              )}
            >
              {skill.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {!isLocked && (
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <Zap className="h-3 w-3" />
                  <span>
                    {skill.xp}/{skill.requiredXp}
                  </span>
                </div>
              )}
              {skill.challengeCount > 0 && !isLocked && (
                <span className="text-xs text-muted-foreground">
                  {skill.challengeCount} зад.
                </span>
              )}
              {isCompleted && (
                <span className="text-xs text-amber-400 font-medium">
                  Ур. {skill.level}
                </span>
              )}
            </div>

            {/* Progress bar (visible for completed & in-progress) */}
            {!isLocked && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    isCompleted
                      ? "bg-emerald-400"
                      : "bg-amber-400/70"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>

          {/* Chevron */}
          {!isLocked && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          )}
        </div>
      </div>

      {/* Vertical connector line to next skill in same category (CSS border) */}
      {!isLastInCategory && (
        <div className={cn("mx-auto w-0.5 h-3 rounded-full", colors.line)} />
      )}
    </motion.div>
  );

  /* ---- Locked cards are not interactive ---- */
  if (isLocked) return card;

  /* ---- Clickable cards get a Popover with description ---- */
  return (
    <Popover>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        className="bg-[#111118]/95 backdrop-blur-xl border-white/10 text-foreground z-50 max-w-[280px] p-4 rounded-xl shadow-xl"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {skill.icon || categoryEmoji(skill.category)}
            </span>
            <h4 className="font-semibold text-sm">{skill.name}</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {skill.description}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className={cn("font-medium", colors.accent)}>
              <Zap className="h-3 w-3 inline mr-1" />
              {skill.xp} / {skill.requiredXp} XP
            </span>
            {skill.challengeCount > 0 && (
              <span className="text-muted-foreground">
                {skill.challengeCount} задач
              </span>
            )}
          </div>
          <Link
            href={`/challenges?category=${skill.category}`}
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/90 text-white hover:bg-emerald-500 transition-colors"
          >
            {isCompleted ? "Повторить" : "Начать"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Category column header                                             */
/* ------------------------------------------------------------------ */

function CategoryHeader({
  category,
  completed,
  total,
  colors,
  delay,
}: {
  category: string;
  completed: number;
  total: number;
  colors: (typeof categoryColors)[string];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border mb-3",
        "bg-gradient-to-r",
        colors.bg,
        colors.border
      )}
    >
      <span className="text-xl">{categoryEmoji(category)}</span>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold truncate">
          {categoryLabel(category)}
        </h2>
        <span className="text-xs text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skill detail bottom panel (for mobile / detailed view)             */
/* ------------------------------------------------------------------ */

function SkillDetailPanel({
  skill,
  onClose,
}: {
  skill: SkillNode;
  onClose: () => void;
}) {
  const status = getSkillStatus(skill);
  const pct =
    skill.requiredXp > 0
      ? Math.min((skill.xp / skill.requiredXp) * 100, 100)
      : 0;
  const colors = categoryColors[skill.category] || categoryColors.prompting;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 p-4 pb-8 sm:pb-4"
    >
      <div className="mx-auto max-w-lg">
        <div
          className={cn(
            "relative rounded-2xl p-5 border",
            "bg-[#111118]/95 backdrop-blur-xl",
            colors.border,
            "shadow-2xl"
          )}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-2xl shrink-0">
              {skill.icon || categoryEmoji(skill.category)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold">{skill.name}</h3>
                {status === "completed" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Пройдено
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {skill.description}
              </p>

              {/* Progress */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {skill.xp} / {skill.requiredXp} XP
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      status === "completed"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      status === "completed"
                        ? "bg-emerald-400"
                        : "bg-amber-400/70"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {status !== "locked" && skill.challengeCount > 0 && (
                  <Link href={`/challenges?category=${skill.category}`}>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium",
                        "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white",
                        "hover:from-emerald-500 hover:to-emerald-400",
                        "shadow-md shadow-emerald-500/20"
                      )}
                    >
                      {status === "completed" ? "Повторить" : "Начать"} (
                      {skill.challengeCount} задач)
                    </motion.button>
                  </Link>
                )}
                {status === "locked" && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Пройдите родительский навык для доступа
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm"
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main SkillTree component — grid layout                             */
/* ------------------------------------------------------------------ */

export function SkillTree({ skills }: SkillTreeProps) {
  const [selectedSkill, setSelectedSkill] = useState<SkillNode | null>(null);

  /* Group skills by category */
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, SkillNode[]> = {};
    for (const skill of skills) {
      if (!groups[skill.category]) groups[skill.category] = [];
      groups[skill.category].push(skill);
    }
    // Sort skills within each category by order
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => a.order - b.order);
    }
    return groups;
  }, [skills]);

  const categories = sortCategories(Object.keys(groupedByCategory));

  /* Summary stats */
  const totalSkills = skills.length;
  const completedSkills = skills.filter(
    (s) => getSkillStatus(s) === "completed"
  ).length;
  const inProgressSkills = skills.filter(
    (s) => getSkillStatus(s) === "in-progress"
  ).length;

  return (
    <div>
      {/* Stats summary */}
      <div className="flex items-center gap-4 mb-5 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span className="text-muted-foreground">
            {completedSkills} пройдено
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
          <span className="text-muted-foreground">
            {inProgressSkills} в процессе
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="text-muted-foreground">
            {totalSkills - completedSkills - inProgressSkills} закрыто
          </span>
        </div>
      </div>

      {/* Grid: 1 col on mobile, 2 on sm, 3 on lg */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, catIdx) => {
            const catSkills = groupedByCategory[cat];
            const catCompleted = catSkills.filter(
              (s) => getSkillStatus(s) === "completed"
            ).length;
            const colors =
              categoryColors[cat] || categoryColors.prompting;
            const headerDelay = catIdx * 0.08;

            return (
              <div key={cat} className="flex flex-col">
                {/* Category header */}
                <CategoryHeader
                  category={cat}
                  completed={catCompleted}
                  total={catSkills.length}
                  colors={colors}
                  delay={headerDelay}
                />

                {/* Skill cards with vertical connectors */}
                <div className="flex flex-col gap-0">
                  {catSkills.map((skill, skillIdx) => {
                    const status = getSkillStatus(skill);
                    const cardDelay =
                      headerDelay + 0.1 + skillIdx * 0.06;
                    const isLast = skillIdx === catSkills.length - 1;

                    return (
                      <SkillGridCard
                        key={skill.id}
                        skill={skill}
                        status={status}
                        colors={colors}
                        delay={cardDelay}
                        isLastInCategory={isLast}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Навыки пока не добавлены</p>
        </div>
      )}

      {/* Skill detail panel (bottom sheet for mobile) */}
      <AnimatePresence>
        {selectedSkill && (
          <SkillDetailPanel
            skill={selectedSkill}
            onClose={() => setSelectedSkill(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
