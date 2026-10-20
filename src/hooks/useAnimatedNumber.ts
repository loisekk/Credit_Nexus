"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated numeric counter that settles exactly on the target value.
 * Uses requestAnimationFrame with an ease-out curve; respects reduced motion
 * by jumping straight to the target.
 */
export function useAnimatedNumber(
  target: number,
  options?: { durationMs?: number; reducedMotion?: boolean }
): number {
  const { durationMs = 1100, reducedMotion = false } = options ?? {};
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (reducedMotion) {
      fromRef.current = target;
      // Schedule asynchronously to avoid a synchronous state cascade.
      const raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, reducedMotion]);

  return value;
}
