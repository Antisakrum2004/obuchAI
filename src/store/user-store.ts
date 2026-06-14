"use client";

import { create } from "zustand";

interface UserState {
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  xp: number;
  level: number;
  streak: number;
  maxStreak: number;
  completedChallenges: number;
  rank: number;
  difficultyBoost: string | null;
  isLoading: boolean;
  setUser: (user: Partial<UserState>) => void;
  addXp: (amount: number) => void;
  setLevel: (level: number) => void;
  setStreak: (streak: number) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  id: null,
  name: null,
  email: null,
  image: null,
  role: null,
  xp: 0,
  level: 1,
  streak: 0,
  maxStreak: 0,
  completedChallenges: 0,
  rank: 0,
  difficultyBoost: null,
  isLoading: true,
};

/**
 * Calculate level from total XP.
 * Level formula: each level requires progressively more XP.
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 250 XP, etc.
 */
function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpNeeded = 100;
  let xpAccum = 0;
  while (xpAccum + xpNeeded <= totalXp) {
    xpAccum += xpNeeded;
    level++;
    xpNeeded = Math.floor(100 * Math.pow(1.3, level - 1));
  }
  return level;
}

export const useUserStore = create<UserState>((set) => ({
  ...initialState,
  setUser: (user) => set((state) => ({ ...state, ...user })),
  addXp: (amount) => set((state) => {
    const newXp = state.xp + amount;
    const newLevel = calculateLevel(newXp);
    return { xp: newXp, level: newLevel };
  }),
  setLevel: (level) => set({ level }),
  setStreak: (streak) => set({ streak }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set(initialState),
}));
