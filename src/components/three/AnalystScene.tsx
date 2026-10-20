"use client";

import { Component, Suspense, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { usePrefersReducedMotion, useWebGLSupport } from "@/hooks/useEnvironment";
import { CameraRig } from "./CameraRig";
import { CharacterController } from "./CharacterController";
import { NexusCharacter } from "./NexusCharacter";
import { SceneEnvironment, type SceneQuality } from "./SceneEnvironment";
import { SceneLighting } from "./SceneLighting";
import { SceneFallback } from "./SceneFallback";

export type SceneMode = "hero" | "workspace" | "compact";

/** React error boundary — if WebGL explodes at runtime, the UI stays usable. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <SceneFallback reason="crash" />;
    return this.props.children;
  }
}

/**
 * The 3D analysis chamber. Degrades gracefully:
 * - no WebGL → SceneFallback (UI remains fully functional)
 * - runtime WebGL error → error boundary → SceneFallback
 * - weak GPU → PerformanceMonitor drops particle/shard density and DPR
 * - reduced motion → no auto-orbit, particles, or sweep animation
 */
export function AnalystScene({ mode }: { mode: SceneMode }) {
  const webgl = useWebGLSupport();
  const prefersReduced = usePrefersReducedMotion();
  const visible = useCharacterStore((s) => s.visible);
  const manualReduced = useCharacterStore((s) => s.reducedMotion);
  const reduced = prefersReduced || manualReduced;
  const [quality, setQuality] = useState<SceneQuality>("high");

  const canvasStyle = useMemo(
    () => ({ width: "100%", height: "100%" } as const),
    []
  );

  if (!webgl) {
    return <SceneFallback reason="webgl" />;
  }

  return (
    <SceneErrorBoundary>
      <Canvas
        style={canvasStyle}
        dpr={quality === "high" ? [1, 1.75] : [0.85, 1.2]}
        camera={{ position: [1.15, 1.5, 4.6], fov: 42, near: 0.1, far: 60 }}
        gl={{
          antialias: quality === "high",
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#04070E"]} />
        <fog attach="fog" args={["#04070E", 8.5, 17]} />
        <PerformanceMonitor
          onFallback={() => setQuality("low")}
          onChange={({ fps }) => {
            if (fps > 50 && quality === "low") setQuality("high");
          }}
        />
        <Suspense fallback={null}>
          <CharacterController>
            {(pose) => (
              <>
                <SceneLighting pose={pose} />
                <SceneEnvironment pose={pose} quality={quality} reduced={reduced} />
                {visible && <NexusCharacter pose={pose} />}
              </>
            )}
          </CharacterController>
        </Suspense>
        <CameraRig mode={mode} reduced={reduced} />
      </Canvas>
    </SceneErrorBoundary>
  );
}
