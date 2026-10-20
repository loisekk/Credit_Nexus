"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useCharacterStore } from "@/stores/useCharacterStore";
import type { SceneMode } from "./AnalystScene";

const PRESETS: Record<SceneMode, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  hero: { pos: new THREE.Vector3(1.15, 1.5, 4.6), target: new THREE.Vector3(0, 1.08, 0) },
  workspace: { pos: new THREE.Vector3(0, 1.62, 4.15), target: new THREE.Vector3(0, 1.16, 0) },
  compact: { pos: new THREE.Vector3(0.85, 1.42, 3.7), target: new THREE.Vector3(0, 1.12, 0) },
};

/**
 * Orbit camera with safe zoom limits, programmatic preset transitions and a
 * one-time auto-orbit on the welcome screen. Any user interaction takes
 * permanent control until "Reset camera" is invoked.
 */
export function CameraRig({ mode, reduced }: { mode: SceneMode; reduced: boolean }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const cameraResetSignal = useCharacterStore((s) => s.cameraResetSignal);
  const transition = useRef<{
    active: boolean;
    from: THREE.Vector3;
    fromTarget: THREE.Vector3;
    to: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    duration: number;
  }>({
    active: false,
    from: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    to: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    t: 0,
    duration: 1.1,
  });
  const userTookControl = useRef(false);
  const lastSignal = useRef(cameraResetSignal);

  useEffect(() => {
    if (mode !== "hero") return;
    // Preset switch: begin a smooth transition.
    const tr = transition.current;
    tr.active = true;
    tr.from.copy(camera.position);
    tr.fromTarget.copy(controls.current?.target ?? new THREE.Vector3(0, 1.1, 0));
    tr.to.copy(PRESETS[mode].pos);
    tr.toTarget.copy(PRESETS[mode].target);
    tr.t = 0;
    tr.duration = reduced ? 0.01 : 1.1;
  }, [mode, camera, reduced]);

  useEffect(() => {
    if (cameraResetSignal === lastSignal.current) return;
    lastSignal.current = cameraResetSignal;
    userTookControl.current = false;
    const tr = transition.current;
    tr.active = true;
    tr.from.copy(camera.position);
    tr.fromTarget.copy(controls.current?.target ?? new THREE.Vector3(0, 1.1, 0));
    tr.to.copy(PRESETS[mode].pos);
    tr.toTarget.copy(PRESETS[mode].target);
    tr.t = 0;
    tr.duration = reduced ? 0.01 : 0.9;
  }, [cameraResetSignal, camera, mode, reduced]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const tr = transition.current;
    if (tr.active) {
      c.enabled = false;
      tr.t = Math.min(1, tr.t + delta / tr.duration);
      const e = 1 - Math.pow(1 - tr.t, 3);
      camera.position.lerpVectors(tr.from, tr.to, e);
      c.target.lerpVectors(tr.fromTarget, tr.toTarget, e);
      if (tr.t >= 1) {
        tr.active = false;
        c.enabled = true;
        c.update();
      }
    }
    // Gentle auto-orbit on the welcome view, before the user takes control.
    c.autoRotate = mode === "hero" && !userTookControl.current && !reduced && !tr.active;
    c.autoRotateSpeed = 0.55;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.6}
      maxDistance={7.5}
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.52}
      target={[0, 1.1, 0]}
      onStart={() => {
        userTookControl.current = true;
      }}
    />
  );
}
