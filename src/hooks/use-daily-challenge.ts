"use client";

import { useState, useEffect } from "react";

interface DailyChallenge {
  assignmentId: string;
  challengeId: string;
  completed: boolean;
  completedAt: string | null;
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    type: string;
    category: string;
    xpReward: number;
  } | null;
}

export function useDailyChallenge() {
  const [data, setData] = useState<DailyChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDaily() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/daily");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError("Не удалось загрузить ежедневную задачу");
        }
      } catch {
        setError("Ошибка сети");
      } finally {
        setIsLoading(false);
      }
    }
    fetchDaily();
  }, []);

  return { data, isLoading, error, refetch: () => window.location.reload() };
}
