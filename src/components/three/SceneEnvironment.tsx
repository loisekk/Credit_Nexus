"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { PoseRuntime } from "./poseEngine";

export type SceneQuality = "high" | "low";

/** Soft fake contact shadow texture (radial gradient) — cheap, no shadow maps. */
function useContactShadowTexture(): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(2,6,14,0.62)");
    gradient.addColorStop(0.65, "rgba(2,6,14,0.28)");
    gradient.addColorStop(1, "rgba(2,6,14,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Free the GPU texture when the environment unmounts.
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Holographic analysis console floating in front of NEXUS. */
function HoloConsole({ pose }: { pose: PoseRuntime }) {
  const bars = useRef<THREE.Group>(null);
  const frameMats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const barMats = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const _frameScratch = useRef(new THREE.Color("#164E63"));

  useFrame((state) => {
    if (!bars.current) return;
    const t = state.clock.elapsedTime;
    const activity = 0.25 + pose.scan * 1.4;
    bars.current.children.forEach((child, i) => {
      const target = 0.15 + Math.abs(Math.sin(t * (1.1 + i * 0.37) * activity + i)) * 0.55;
      child.scale.y = THREE.MathUtils.lerp(child.scale.y, target, 0.2);
    });
    _frameScratch.current.lerp(pose.visorColor, 0.04);
    for (const m of frameMats.current) if (m) m.color.copy(_frameScratch.current);
    for (const m of barMats.current) if (m) m.color.copy(_frameScratch.current);
  });

  const frameMatProps = {
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  };

  return (
    <group position={[0, 1.02, 0.58]} rotation={[-0.42, 0, 0]}>
      {/* panel body */}
      <mesh>
        <planeGeometry args={[0.56, 0.34]} />
        <meshBasicMaterial
          color="#0E7490"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* frame edges */}
      {[
        { args: [0.56, 0.008], pos: [0, 0.17] },
        { args: [0.56, 0.008], pos: [0, -0.17] },
        { args: [0.008, 0.34], pos: [0.28, 0] },
        { args: [0.008, 0.34], pos: [-0.28, 0] },
      ].map((e, i) => (
        <mesh key={i} position={[e.pos[0], e.pos[1], 0.001]}>
          <planeGeometry args={[e.args[0], e.args[1]]} />
          <meshBasicMaterial
            ref={(m) => { frameMats.current[i] = m; }}
            color="#164E63"
            {...frameMatProps}
          />
        </mesh>
      ))}
      {/* data bars */}
      <group ref={bars}>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} position={[-0.21 + i * 0.07, -0.12, 0.004]}>
            <boxGeometry args={[0.032, 0.2, 0.002]} />
            <meshBasicMaterial
              ref={(m) => { barMats.current[i] = m; }}
              color="#67E8F9"
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>
      {/* scan line */}
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[0.52, 0.003]} />
        <meshBasicMaterial
          ref={(m) => { frameMats.current[4] = m; }}
          color="#164E63"
          {...frameMatProps}
        />
      </mesh>
    </group>
  );
}

/** Orbiting holographic data shards (static materials — no per-frame mutation). */
function DataShards({ reduced, quality }: { reduced: boolean; quality: SceneQuality }) {
  const group = useRef<THREE.Group>(null);
  const shards = useMemo(
    () =>
      Array.from({ length: quality === "high" ? 7 : 4 }).map((_, i) => ({
        radius: 1.9 + (i % 3) * 0.35,
        speed: 0.05 + (i % 4) * 0.022,
        phase: (i / 7) * Math.PI * 2,
        y: 1.15 + ((i * 0.37) % 1.3),
        w: 0.16 + (i % 3) * 0.05,
        color: i % 3 === 0 ? "#8B5CF6" : "#22D3EE",
      })),
    [quality]
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const s = shards[i];
      const a = s.phase + (reduced ? 0 : t * s.speed);
      child.position.set(
        Math.cos(a) * s.radius,
        s.y + (reduced ? 0 : Math.sin(t * 0.5 + s.phase) * 0.08),
        Math.sin(a) * s.radius
      );
    });
  });

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <Billboard key={i}>
          <mesh>
            <planeGeometry args={[s.w, s.w * 0.66]} />
            <meshBasicMaterial
              color={s.color}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

/** Ambient dust motes — strict budget (160 points, additive, no depth write). */
function AmbientParticles({ reduced }: { reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 1.1 + Math.random() * 2.4;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 3.1;
      positions[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 0.04 + Math.random() * 0.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    (geo as THREE.BufferGeometry & { userData: { speeds: Float32Array } }).userData.speeds =
      speeds;
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color("#7DD3FC"),
      size: 0.02,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((_, delta) => {
    if (!points.current || reduced) return;
    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const speeds = (points.current.geometry as THREE.BufferGeometry & {
      userData: { speeds: Float32Array };
    }).userData.speeds;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      arr[i * 3 + 1] += speeds[i] * Math.min(delta, 0.05);
      if (arr[i * 3 + 1] > 3.2) arr[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/** Vertical scan sweep around the character during analysis. */
function ScanRing({ pose, reduced }: { pose: PoseRuntime; reduced: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!ring.current || !mat.current) return;
    const t = state.clock.elapsedTime;
    const intensity = pose.scan;
    mat.current.opacity = intensity * 0.75;
    mat.current.color.lerp(pose.visorColor, 0.08);
    const cycle = reduced ? 0.9 : (t * 0.65) % 1;
    ring.current.position.y = 0.18 + cycle * 1.62;
    ring.current.scale.setScalar(1 + Math.sin(cycle * Math.PI) * 0.06);
    ring.current.visible = intensity > 0.02;
  });

  return (
    <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.52, 0.012, 8, 48]} />
      <meshBasicMaterial
        ref={mat}
        color="#22D3EE"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Circular platform, state-reactive rim, grid floor. */
export function SceneEnvironment({
  pose,
  quality,
  reduced,
}: {
  pose: PoseRuntime;
  quality: SceneQuality;
  reduced: boolean;
}) {
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);
  const innerMat = useRef<THREE.MeshBasicMaterial>(null);
  const shadowTexture = useContactShadowTexture();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (rimMat.current) {
      rimMat.current.emissive.lerp(pose.ringColor, 0.05);
      rimMat.current.emissiveIntensity =
        pose.ringIntensity * (0.85 + Math.sin(t * 2.1) * 0.15);
    }
    if (innerMat.current) {
      innerMat.current.color.lerp(pose.ringColor, 0.03);
    }
  });

  return (
    <group>
      {/* platform */}
      <mesh position={[0, -0.055, 0]}>
        <cylinderGeometry args={[1.5, 1.62, 0.11, 64]} />
        <meshStandardMaterial color="#0B1322" metalness={0.6} roughness={0.42} />
      </mesh>
      {/* reactive rim */}
      <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.015, 10, 96]} />
        <meshStandardMaterial
          ref={rimMat}
          color="#0A101C"
          emissive="#22D3EE"
          emissiveIntensity={1.4}
        />
      </mesh>
      {/* inner ring */}
      <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.12, 0.007, 8, 80]} />
        <meshBasicMaterial ref={innerMat} color="#312E81" transparent opacity={0.55} />
      </mesh>
      {/* fake contact shadow */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>

      {/* floor grid */}
      <Grid
        position={[0, 0.002, 0]}
        args={[24, 24]}
        cellSize={0.55}
        cellThickness={0.6}
        cellColor="#16213A"
        sectionSize={2.75}
        sectionThickness={1}
        sectionColor="#20304F"
        fadeDistance={19}
        fadeStrength={2.2}
        infiniteGrid
      />

      <HoloConsole pose={pose} />
      <ScanRing pose={pose} reduced={reduced} />
      {quality === "high" && (
        <>
          <DataShards reduced={reduced} quality={quality} />
          {!reduced && <AmbientParticles reduced={reduced} />}
        </>
      )}
    </group>
  );
}
