"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/user-store";

export function useUserStats() {
  const { setUser, setLoading, ...state } = useUserStore();

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/stats");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [setUser, setLoading]);

  return state;
}

export function useRefetchStats() {
  const { setUser } = useUserStore();
  return async () => {
    try {
      const res = await fetch("/api/user/stats");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch {
      // silently fail
    }
  };
}
