"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SkillTree } from "@/components/skills/skill-tree";
import { TreePine } from "lucide-react";
import { motion } from "framer-motion";

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((catIdx) => (
              <div key={catIdx} className="flex flex-col">
                {/* Category header skeleton */}
                <div className="shimmer h-10 w-full rounded-xl mb-3" />
                {/* Skill card skeletons */}
                <div className="flex flex-col gap-0">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="flex items-start gap-3 w-full p-3">
                        <div className="shimmer h-11 w-11 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="shimmer h-4 w-3/4 rounded" />
                          <div className="shimmer h-3 w-1/2 rounded" />
                          <div className="shimmer h-1.5 w-full rounded-full" />
                        </div>
                      </div>
                      {/* Connector line skeleton */}
                      {i < 2 && <div className="shimmer w-0.5 h-3 rounded-full" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SkillTree skills={skills} />
        )}
      </div>
    </AppLayout>
  );
}
