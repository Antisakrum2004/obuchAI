"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AppSettings {
  particles: boolean;
  confetti: boolean;
  liquidXp: boolean;
  heartAnimations: boolean;
  streakFire: boolean;
  avatarFrames: boolean;
  microAnimations: boolean;
  adaptiveDifficulty: boolean;
}

const defaultSettings: AppSettings = {
  particles: true,
  confetti: true,
  liquidXp: true,
  heartAnimations: true,
  streakFire: true,
  avatarFrames: true,
  microAnimations: true,
  adaptiveDifficulty: true,
};

interface AppSettingsContextType extends AppSettings {
  isLoading: boolean;
  refetch: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  ...defaultSettings,
  isLoading: true,
  refetch: () => {},
});

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          particles: data.particles === "true",
          confetti: data.confetti === "true",
          liquidXp: data.liquid_xp === "true",
          heartAnimations: data.heart_animations === "true",
          streakFire: data.streak_fire === "true",
          avatarFrames: data.avatar_frames === "true",
          microAnimations: data.micro_animations === "true",
          adaptiveDifficulty: data.adaptive_difficulty === "true",
        });
      }
    } catch {
      // keep defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Re-fetch every 60 seconds
    const interval = setInterval(fetchSettings, 60000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  // Apply data attributes for micro_animations and adaptive_difficulty
  // so CSS can target them to disable animations
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-micro-animations", settings.microAnimations ? "on" : "off");
    document.documentElement.setAttribute("data-adaptive-difficulty", settings.adaptiveDifficulty ? "on" : "off");
  }, [settings.microAnimations, settings.adaptiveDifficulty]);

  return (
    <AppSettingsContext.Provider value={{ ...settings, isLoading, refetch: fetchSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
