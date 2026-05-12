"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { categoryEmoji, categoryLabel } from "@/lib/gamification";
import { TreePine, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface SkillItem {
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

const categoryColors: Record<string, string> = {
  prompting: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
  agents: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
  tools: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20",
  automation: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
  "1c": "from-red-500/20 to-red-500/5 border-red-500/20",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSkills() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/skills");
        if (res.ok) {
          const data = await res.json();
          setSkills(data);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchSkills();
  }, []);

  // Group by category
  const groupedSkills = skills.reduce<Record<string, SkillItem[]>>((acc, skill) => {
    const cat = skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <TreePine className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold">Навыки</h1>
          </div>
          <p className="text-muted-foreground">
            Прокачивай AI-навыки, решая задачи по каждой категории
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-xl p-5 shimmer h-40" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSkills).map(([category, categorySkills], catIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.1 }}
              >
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">{categoryEmoji(category)}</span>
                  {categoryLabel(category)}
                </h2>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categorySkills.map((skill, index) => {
                    const percentage = Math.min((skill.xp / skill.requiredXp) * 100, 100);
                    const isLocked = skill.xp === 0 && skill.challengeCount === 0;
                    const colorClass = categoryColors[skill.category] || "from-gray-500/20 to-gray-500/5 border-gray-500/20";

                    return (
                      <motion.div
                        key={skill.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: catIndex * 0.1 + index * 0.05 }}
                      >
                        <Link href={`/challenges?category=${skill.category}`}>
                          <div
                            className={`relative glass rounded-xl p-5 transition-all duration-200 hover:bg-white/[0.07] cursor-pointer overflow-hidden ${isLocked ? "opacity-50" : ""}`}
                          >
                            {/* Background gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} pointer-events-none`} />

                            <div className="relative">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{skill.icon || categoryEmoji(skill.category)}</span>
                                  <div>
                                    <h3 className="font-semibold text-sm">{skill.name}</h3>
                                    <p className="text-xs text-muted-foreground">Уровень {skill.level}</p>
                                  </div>
                                </div>
                                {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                              </div>

                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {skill.description}
                              </p>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{skill.xp}/{skill.requiredXp} XP</span>
                                  <span className="text-emerald-400">{Math.round(percentage)}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full progress-gradient transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                <span>{skill.challengeCount} задач</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}

            {Object.keys(groupedSkills).length === 0 && (
              <div className="text-center py-16">
                <TreePine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">Навыки пока не добавлены</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
