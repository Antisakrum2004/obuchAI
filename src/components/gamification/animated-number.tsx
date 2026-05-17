"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, className, duration = 800 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;

    const startTime = performance.now();
    const diff = value - prev;

    // Defer popping state to avoid synchronous setState in effect
    const popTimer = setTimeout(() => setPopping(true), 0);
    const popResetTimer = setTimeout(() => setPopping(false), 300);

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prev + diff * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearTimeout(popTimer);
      clearTimeout(popResetTimer);
    };
  }, [value, duration]);

  return (
    <span className={className} style={popping ? { animation: "count-pop 0.3s ease-out" } : undefined}>
      {displayValue.toLocaleString()}
    </span>
  );
}
