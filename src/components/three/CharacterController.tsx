"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { computePose, sharedPoseRuntime } from "./poseEngine";

const GREETING_DURATION_MS = 2800;

/**
 * Finite-state machine driver: subscribes to application state and advances
 * the shared pose runtime every frame. All transitions are damped — hence
 * interruptible and overlap-free by construction.
 */
export function CharacterController({
  children,
}: {
  children: (pose: typeof sharedPoseRuntime) => React.ReactNode;
}) {
  const state = useCharacterStore((s) => s.state);
  const reducedMotion = useCharacterStore((s) => s.reducedMotion);
  const setSoftState = useCharacterStore((s) => s.setSoftState);

  useEffect(() => {
    sharedPoseRuntime.state = state;
    sharedPoseRuntime.stateAt = performance.now();
  }, [state]);

  // Greeting is a timed behavior: return to idle automatically.
  useEffect(() => {
    if (state !== "greeting") return;
    const timer = window.setTimeout(() => setSoftState("idle"), GREETING_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state, setSoftState]);

  useFrame((_, delta) => {
    const now = performance.now();
    const stateElapsed = (now - sharedPoseRuntime.stateAt) / 1000;
    computePose(sharedPoseRuntime, Math.min(delta, 0.05), now / 1000, stateElapsed, reducedMotion);
  });

  return <>{children(sharedPoseRuntime)}</>;
}
