"use client";

import { useEffect, useState } from "react";

/** True when the user prefers reduced motion (OS-level or browser setting). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Detects WebGL availability (webgl2 or webgl) — used for the 3D fallback. */
export function useWebGLSupport(): boolean {
  // Client-only app (dynamic ssr:false): safe to probe synchronously once.
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl");
      return !!gl;
    } catch {
      return false;
    }
  });

  return supported;
}
