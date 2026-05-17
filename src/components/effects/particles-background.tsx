"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Particle data (static, generated once) ─── */

interface ParticleData {
  id: number;
  x: number; // % from left
  y: number; // % from top
  size: number; // 1-3 px
  color: "emerald" | "purple";
  duration: number; // 15-30s
  delay: number; // 0 to -duration (negative to stagger start)
  driftX: number; // px range ±60
  driftY: number; // px range ±40
}

const DESKTOP_COUNT = 18;
const MOBILE_COUNT = 6;

function generateParticles(count: number): ParticleData[] {
  // Seeded pseudo-random for consistent SSR/CSR output
  const seed = 42;
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };

  return Array.from({ length: count }, (_, i) => {
    const duration = 15 + Math.floor(rand() * 16); // 15-30s
    return {
      id: i,
      x: Math.floor(rand() * 96) + 2, // 2-98%
      y: Math.floor(rand() * 96) + 2, // 2-98%
      size: 1 + Math.floor(rand() * 3), // 1-3px
      color: rand() > 0.5 ? "emerald" : "purple",
      duration,
      delay: -(Math.floor(rand() * duration)), // stagger start
      driftX: Math.floor((rand() - 0.5) * 120), // ±60px
      driftY: Math.floor((rand() - 0.5) * 80), // ±40px
    };
  });
}

const DESKTOP_PARTICLES = generateParticles(DESKTOP_COUNT);
const MOBILE_PARTICLES = generateParticles(MOBILE_COUNT);

/* ─── Custom event name for XP flash ─── */
export const XP_EARNED_EVENT = "particles:xp-earned";

/**
 * Dispatch this from anywhere to trigger a particle flash.
 * Example: window.dispatchEvent(new CustomEvent("particles:xp-earned", { detail: { count: 5 } }))
 */
export function dispatchXpFlash(extraCount = 4) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(XP_EARNED_EVENT, { detail: { count: extraCount } })
    );
  }
}

/* ─── Extra burst particles (appear on XP, fade out) ─── */

interface BurstParticle {
  id: string;
  x: number;
  y: number;
  size: number;
  color: "emerald" | "purple";
  duration: number;
  driftX: number;
  driftY: number;
}

function generateBurst(count: number): BurstParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `burst-${Date.now()}-${i}`,
    x: Math.floor(Math.random() * 90) + 5,
    y: Math.floor(Math.random() * 90) + 5,
    size: 2 + Math.floor(Math.random() * 2), // 2-3px (slightly bigger)
    color: Math.random() > 0.4 ? "emerald" : "purple", // slight emerald bias
    duration: 8 + Math.floor(Math.random() * 8), // 8-15s
    driftX: Math.floor((Math.random() - 0.5) * 160),
    driftY: Math.floor((Math.random() - 0.5) * 100),
  }));
}

/* ─── Component ─── */

export function ParticlesBackground() {
  const { particles } = useAppSettings();
  const isMobile = useIsMobile();
  const [flashing, setFlashing] = useState(false);
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleXpEarned = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail ?? { count: 4 };
    const count = Math.min(detail.count ?? 4, 8); // cap at 8

    // Flash existing particles brighter
    setFlashing(true);

    // Add burst particles (skip on mobile for perf)
    if (!isMobile) {
      setBurstParticles((prev) => {
        const newBurst = generateBurst(count);
        // Keep total burst under 12 to avoid perf issues
        const combined = [...prev, ...newBurst];
        return combined.slice(-12);
      });
    }

    // Clear flash after 1.2s
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlashing(false), 1200);
  }, [isMobile]);

  // Remove burst particles after they've had time to animate
  useEffect(() => {
    if (burstParticles.length === 0) return;
    const timer = setTimeout(() => {
      setBurstParticles([]);
    }, 15000);
    return () => clearTimeout(timer);
  }, [burstParticles]);

  useEffect(() => {
    window.addEventListener(XP_EARNED_EVENT, handleXpEarned);
    return () => {
      window.removeEventListener(XP_EARNED_EVENT, handleXpEarned);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleXpEarned]);

  const colorMap = {
    emerald: flashing ? "rgba(52, 211, 153, 0.5)" : "rgba(52, 211, 153, 0.2)",
    purple: flashing ? "rgba(192, 132, 252, 0.5)" : "rgba(192, 132, 252, 0.2)",
  };

  const burstColorMap = {
    emerald: "rgba(52, 211, 153, 0.45)",
    purple: "rgba(192, 132, 252, 0.45)",
  };

  if (!particles) return null;

  const activeParticles = isMobile ? MOBILE_PARTICLES : DESKTOP_PARTICLES;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      {/* Persistent particles — fewer on mobile */}
      {activeParticles.map((p) => (
        <div
          key={p.id}
          className="particle-drift"
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: "50%",
            backgroundColor: colorMap[p.color],
            willChange: "transform",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--drift-x" as string]: `${p.driftX}px`,
            ["--drift-y" as string]: `${p.driftY}px`,
            transition: "background-color 0.3s ease",
          }}
        />
      ))}

      {/* Burst particles (XP flash) — desktop only */}
      {!isMobile && burstParticles.map((p) => (
        <div
          key={p.id}
          className="particle-drift particle-burst"
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: "50%",
            backgroundColor: burstColorMap[p.color],
            willChange: "transform, opacity",
            animationDuration: `${p.duration}s`,
            animationDelay: "0s",
            ["--drift-x" as string]: `${p.driftX}px`,
            ["--drift-y" as string]: `${p.driftY}px`,
          }}
        />
      ))}
    </div>
  );
}
