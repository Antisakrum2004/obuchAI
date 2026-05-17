"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface ThemeToggleProps {
  size?: "default" | "small";
}

export function ThemeToggle({ size = "default" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const width = size === "small" ? 44 : 56;
  const height = size === "small" ? 22 : 28;
  const ballSize = size === "small" ? 16 : 20;
  const iconSize = 12;
  const padding = 3;

  if (!mounted) {
    return (
      <div
        style={{ width, height }}
        className="rounded-full bg-[#1a1a2e] animate-pulse"
      />
    );
  }

  const isSlate = theme === "slate";
  const toggle = () => {
    setTheme(isSlate ? "midnight" : "slate");
  };

  // Ball slides from left (midnight) to right (slate)
  const ballLeft = isSlate ? width - ballSize - padding : padding;

  return (
    <button
      onClick={toggle}
      className="relative cursor-pointer rounded-full border-0 p-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      style={{
        width,
        height,
        background: isSlate ? "#2a2a3e" : "#1a1a2e",
      }}
      aria-label={isSlate ? "Switch to Midnight theme" : "Switch to Slate theme"}
      title={isSlate ? "Switch to Midnight" : "Switch to Slate"}
    >
      {/* Moon icon — left side */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          width: iconSize,
          height: iconSize,
          left: (height - iconSize) / 2,
          top: (height - iconSize) / 2,
          stroke: isSlate ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.6)",
          transition: "stroke 200ms",
        }}
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>

      {/* Sun icon — right side */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          width: iconSize,
          height: iconSize,
          right: (height - iconSize) / 2,
          top: (height - iconSize) / 2,
          stroke: isSlate ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.25)",
          transition: "stroke 200ms",
        }}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>

      {/* Sliding ball */}
      <span
        className="absolute rounded-full"
        style={{
          width: ballSize,
          height: ballSize,
          top: (height - ballSize) / 2,
          left: ballLeft,
          background: isSlate
            ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
            : "linear-gradient(135deg, #818cf8, #6366f1)",
          boxShadow: isSlate
            ? "0 0 6px rgba(251,191,36,0.4)"
            : "0 0 6px rgba(99,102,241,0.4)",
          transition: "left 200ms ease-in-out, background 200ms, box-shadow 200ms",
        }}
      />
    </button>
  );
}
