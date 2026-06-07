"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FolderOpen, FileText, ArrowRight } from "lucide-react";

interface KnowledgeSpaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  categoryCount: number;
  articleCount: number;
}

const spaceIcons: Record<string, string> = {
  prompting: "🤖",
  agents: "🧠",
  tools: "🔧",
  automation: "⚡",
  "1c": "💼",
  general: "📚",
  debugging: "🐛",
  review: "👀",
  workflow: "🔄",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function KnowledgePage() {
  const [spaces, setSpaces] = useState<KnowledgeSpaceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/knowledge/spaces")
      .then((r) => r.json())
      .then((data) => {
        setSpaces(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <BookOpen className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">База знаний</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Справочные материалы, глоссарий и статьи по AI для 1C разработчиков
              </p>
            </div>
          </div>
        </motion.div>

        {/* Spaces Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Разделы пока не добавлены
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Скоро здесь появятся статьи и материалы
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2"
          >
            {spaces.map((space) => (
              <motion.div key={space.id} variants={itemVariants}>
                <Link href={`/knowledge/${space.slug}`} className="block group">
                  <Card className="glass card-hover border-white/5 rounded-xl py-0 transition-all duration-300 group-hover:border-emerald-500/30 group-hover:shadow-lg group-hover:shadow-emerald-500/5">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-lg shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                          {space.icon
                            ? spaceIcons[space.icon] || space.icon
                            : "📚"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                            {space.name}
                          </h3>
                          {space.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {space.description}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1 bg-secondary/50"
                        >
                          <FolderOpen className="h-3 w-3" />
                          {space.categoryCount}{" "}
                          {pluralize(space.categoryCount, "категория", "категории", "категорий")}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1 bg-secondary/50"
                        >
                          <FileText className="h-3 w-3" />
                          {space.articleCount}{" "}
                          {pluralize(space.articleCount, "статья", "статьи", "статей")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Quick Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass rounded-xl p-4 border-white/5"
        >
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="text-lg">💡</span>
            <span>
              Нажмите <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono border border-white/10">Ctrl+K</kbd> для быстрого поиска по глоссарию
            </span>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}
