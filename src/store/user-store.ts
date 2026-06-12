"use client";

import { create } from "zustand";
import { calculateLevel } from "@/lib/gamification";

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
  isLoading: true,
};

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
