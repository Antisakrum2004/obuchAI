"use client";

import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Target, Search, CheckCircle2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChallengeListItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  isSolved?: boolean;
  cooldownUntil?: string | null;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function fetchChallenges() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (difficultyFilter !== "all") params.set("difficulty", difficultyFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      // Add cache-busting timestamp to avoid stale data
      params.set("_t", Date.now().toString());

      const res = await fetch(`/api/challenges?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, difficultyFilter, typeFilter]);

  // Also re-fetch when page gets focus (user returns from solving a task)
  useEffect(() => {
    const onFocus = () => fetchChallenges();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, difficultyFilter, typeFilter]);

  // Sort challenges: unsolved first, solved at the bottom
  const sortedChallenges = useMemo(() => {
    const source = searchQuery.trim()
      ? challenges.filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : challenges;

    return [...source].sort((a, b) => {
      // Solved challenges go to the bottom — strict boolean check
      const aSolved = a.isSolved === true;
      const bSolved = b.isSolved === true;
      if (aSolved && !bSolved) return 1;
      if (!aSolved && bSolved) return -1;
      // Within same solved status, keep original order
      return 0;
    });
  }, [searchQuery, challenges]);

  // Split into groups for visual separator
  const unsolvedChallenges = useMemo(() => sortedChallenges.filter(c => !c.isSolved), [sortedChallenges]);
  const solvedChallenges = useMemo(() => sortedChallenges.filter(c => c.isSolved), [sortedChallenges]);

  const categories = [
    { value: "all", label: "Все категории" },
    { value: "prompting", label: "✍️ Промптинг" },
    { value: "agents", label: "🤖 AI Агенты" },
    { value: "debugging", label: "🔍 Дебаггинг" },
    { value: "workflow", label: "🔄 Workflow" },
    { value: "1c", label: "🖥️ 1С" },
    { value: "review", label: "👀 Ревью" },
  ];

  const difficulties = [
    { value: "all", label: "Все сложности" },
    { value: "easy", label: "🟢 Легко" },
    { value: "medium", label: "🟡 Средне" },
    { value: "hard", label: "🔴 Сложно" },
  ];

  const types = [
    { value: "all", label: "Все типы" },
    { value: "multiple_choice", label: "Выбор ответа" },
    { value: "prompt_fix", label: "Исправление промпта" },
    { value: "text_input", label: "Ввод текста" },
    { value: "ordering", label: "Упорядочивание" },
    { value: "workflow_build", label: "Сборка workflow" },
  ];

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
            <Target className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold">Задачи</h1>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={fetchChallenges}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <p className="text-muted-foreground">
            Выбирай задачи по навыкам и сложности, зарабатывай опыт
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4 mb-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск задач..."
                className="pl-9 bg-white/5 border-white/10 focus:border-emerald-500/30"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-[150px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  {difficulties.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-white/10">
                  {types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Найдено задач: {sortedChallenges.length}
            {solvedChallenges.length > 0 && (
              <span className="ml-2 text-emerald-400/60">
                ({unsolvedChallenges.length} доступно, {solvedChallenges.length} решено)
              </span>
            )}
          </div>
        </motion.div>

        {/* Challenge List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass rounded-xl p-4 shimmer h-24" />
            ))}
          </div>
        ) : sortedChallenges.length === 0 ? (
          <div className="text-center py-16">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Задачи не найдены</p>
            <p className="text-sm text-muted-foreground mt-1">
              Попробуй изменить фильтры
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Unsolved challenges */}
            {unsolvedChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <ChallengeCard {...challenge} isSolved={challenge.isSolved} cooldownUntil={challenge.cooldownUntil} />
              </motion.div>
            ))}

            {/* Solved section separator */}
            {solvedChallenges.length > 0 && unsolvedChallenges.length > 0 && (
              <div className="flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-emerald-500/20" />
                <div className="flex items-center gap-2 text-emerald-400/60">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Решённые ({solvedChallenges.length})</span>
                </div>
                <div className="flex-1 h-px bg-emerald-500/20" />
              </div>
            )}

            {/* Solved challenges — only show if there are any */}
            {solvedChallenges.length > 0 && solvedChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
              >
                <ChallengeCard {...challenge} isSolved={challenge.isSolved} cooldownUntil={challenge.cooldownUntil} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
