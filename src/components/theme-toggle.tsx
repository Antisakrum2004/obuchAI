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

  if (!mounted) {
    return (
      <div
        style={{
          width: size === "small" ? 72 : 100,
          height: size === "small" ? 36 : 50,
        }}
        className="rounded-full bg-[#28292c] animate-pulse"
      />
    );
  }

  const isSlate = theme === "slate";

  const toggle = () => {
    setTheme(isSlate ? "midnight" : "slate");
  };

  const width = size === "small" ? 72 : 100;
  const height = size === "small" ? 36 : 50;
  const ballSize = size === "small" ? 28 : 40;
  const ballTranslate = isSlate ? width - ballSize - 4 : 0;

  return (
    <button
      onClick={toggle}
      className="relative cursor-pointer rounded-full border-0 p-0 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      style={{
        width,
        height,
        background: isSlate ? "#d8dbe0" : "#28292c",
      }}
      aria-label={isSlate ? "Switch to Midnight theme" : "Switch to Slate theme"}
      title={isSlate ? "Switch to Midnight" : "Switch to Slate"}
    >
      {/* Ball with icon */}
      <span
        className="absolute top-[2px] rounded-full transition-all duration-300 ease-in-out"
        style={{
          left: "2px",
          width: ballSize,
          height: ballSize,
          transform: `translateX(${ballTranslate}px)`,
          background: isSlate
            ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
            : "linear-gradient(135deg, #1e1e3a, #2d2d5a)",
          boxShadow: isSlate
            ? "0 0 12px rgba(245, 158, 11, 0.4), inset 0 0 4px rgba(255,255,255,0.2)"
            : "0 0 8px rgba(139, 92, 246, 0.3), inset -4px -2px 0 0 #e2e8f0",
        }}
      >
        {/* Moon crescent (midnight) or Sun rays (slate) */}
        {isSlate ? (
          /* Sun icon */
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#92400e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "60%", height: "60%", margin: "20%" }}
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
        ) : (
          /* Moon crescent */
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "60%", height: "60%", margin: "20%" }}
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </span>

      {/* Background labels */}
      <span
        className="absolute transition-opacity duration-300 select-none"
        style={{
          left: size === "small" ? 8 : 10,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: isSlate ? 0 : 1,
          fontSize: size === "small" ? 8 : 10,
          fontWeight: 600,
          color: "#94a3b8",
          pointerEvents: "none",
          paddingLeft: ballSize + 2,
        }}
      >
        Midnight
      </span>
      <span
        className="absolute transition-opacity duration-300 select-none"
        style={{
          right: size === "small" ? 8 : 10,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: isSlate ? 1 : 0,
          fontSize: size === "small" ? 8 : 10,
          fontWeight: 600,
          color: "#475569",
          pointerEvents: "none",
          paddingRight: ballSize + 2,
        }}
      >
        Slate
      </span>
    </button>
  );
}
