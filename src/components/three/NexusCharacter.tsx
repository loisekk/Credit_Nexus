"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { PoseRuntime } from "./poseEngine";

interface Parts {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  eyeMeshL: THREE.Mesh;
  eyeMeshR: THREE.Mesh;
}

const GRAPHITE = { color: "#232E42", metalness: 0.72, roughness: 0.34 };
const JOINT = { color: "#161D2C", metalness: 0.82, roughness: 0.3 };
const SUIT = { color: "#1B2436", metalness: 0.55, roughness: 0.42 };
// Scratch color for per-frame eye tinting (avoids per-frame allocation).
const _eyeScratch = new THREE.Color();

/**
 * NEXUS — procedural 3D AI analyst.
 *
 * Built from primitives with a professional silhouette (no GLB required);
 * structured so a rigged GLB can replace the geometry later while keeping the
 * same pose-runtime contract. Materials are declared in JSX (auto-disposed by
 * R3F) and animated only through refs inside frame callbacks.
 */
export function NexusCharacter({ pose }: { pose: PoseRuntime }) {
  const parts = useRef<Parts>({} as Parts);
  const blink = useRef({ next: 2.5, until: -1 });
  const visorMat = useRef<THREE.MeshStandardMaterial>(null);
  const eyeMatL = useRef<THREE.MeshStandardMaterial>(null);
  const eyeMatR = useRef<THREE.MeshStandardMaterial>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const trimMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  useFrame((state, delta) => {
    const p = parts.current;
    if (!p.hips) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);

    // ---- apply pose --------------------------------------------------------
    const breathY = Math.sin(t * 1.35) * 0.008 * pose.breath;
    p.hips.position.y = 0.98 + breathY;
    p.torso.rotation.x = pose.torsoLean + Math.sin(t * 1.35) * 0.006 * pose.breath;
    p.torso.rotation.y = pose.torsoTwist;
    p.head.rotation.y = pose.headYaw;
    p.head.rotation.x = pose.headPitch;

    // Arms: raise swings the upper arm forward-up toward the console.
    p.armL.rotation.x = -pose.armRaiseL * 1.25;
    p.armR.rotation.x = -pose.armRaiseR * 1.25;
    p.armL.rotation.z = 0.1 + pose.armRaiseL * 0.12;
    p.armR.rotation.z = -0.1 - pose.armRaiseR * 0.12;
    p.forearmL.rotation.x = -pose.elbowL * 1.5;
    p.forearmR.rotation.x = -pose.elbowR * 1.5;

    // ---- materials follow the pose palette ---------------------------------
    const lerpK = Math.min(1, 4 * d);
    if (visorMat.current) {
      visorMat.current.emissive.lerp(pose.visorColor, lerpK);
      visorMat.current.emissiveIntensity = pose.visorIntensity;
    }
    _eyeScratch.copy(pose.visorColor).offsetHSL(0, -0.05, 0.08);
    for (const eye of [eyeMatL.current, eyeMatR.current]) {
      if (!eye) continue;
      eye.emissive.lerp(_eyeScratch, lerpK);
      eye.emissiveIntensity = pose.visorIntensity * 1.35;
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = pose.coreIntensity;
    for (const trim of trimMats.current) {
      if (trim) trim.emissiveIntensity = 0.9 + pose.scan * 0.8;
    }

    // ---- blink (subtle, professional) --------------------------------------
    const b = blink.current;
    if (b.until > 0 && t > b.until) {
      b.until = -1;
      b.next = t + 2.2 + Math.random() * 3.4;
    }
    if (b.until < 0 && t > b.next) {
      b.until = t + 0.13;
    }
    const eyeScale = b.until > 0 ? 0.12 : 1;
    if (p.eyeMeshL) p.eyeMeshL.scale.y = THREE.MathUtils.lerp(p.eyeMeshL.scale.y, eyeScale, 0.6);
    if (p.eyeMeshR) p.eyeMeshR.scale.y = THREE.MathUtils.lerp(p.eyeMeshR.scale.y, eyeScale, 0.6);
  });

  const registerTrim = (i: number) => (m: THREE.MeshStandardMaterial | null) => {
    trimMats.current[i] = m;
  };

  return (
    <group>
      <group ref={(g) => { if (g) parts.current.hips = g; }} position={[0, 0.98, 0]}>
        {/* ---------------- torso ---------------- */}
        <group ref={(g) => { if (g) parts.current.torso = g; }}>
          {/* chest block */}
          <RoundedBox args={[0.42, 0.4, 0.26]} radius={0.09} smoothness={4} position={[0, 0.3, 0]}>
            <meshStandardMaterial {...GRAPHITE} />
          </RoundedBox>
          {/* abdominal section */}
          <RoundedBox args={[0.32, 0.22, 0.2]} radius={0.07} smoothness={4} position={[0, 0.05, 0]}>
            <meshStandardMaterial {...SUIT} />
          </RoundedBox>
          {/* chest core (violet reactor) */}
          <mesh position={[0, 0.34, 0.135]}>
            <cylinderGeometry args={[0.045, 0.045, 0.015, 24]} />
            <meshStandardMaterial
              ref={coreMat}
              color="#0A101C"
              emissive="#8B5CF6"
              emissiveIntensity={1.2}
              metalness={0.3}
              roughness={0.3}
            />
          </mesh>
          {/* chest trim line */}
          <mesh position={[0, 0.19, 0.132]}>
            <boxGeometry args={[0.3, 0.012, 0.008]} />
            <meshStandardMaterial
              ref={registerTrim(0)}
              color="#0E1522"
              emissive="#22D3EE"
              emissiveIntensity={1.1}
              metalness={0.5}
              roughness={0.35}
            />
          </mesh>
          {/* collar */}
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.105, 0.125, 0.05, 20]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
          {/* back fins */}
          <mesh position={[0, 0.3, -0.155]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.02, 0.3, 0.06]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
          <mesh position={[0.06, 0.26, -0.16]} rotation={[0.2, 0, -0.35]}>
            <boxGeometry args={[0.016, 0.22, 0.05]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
          <mesh position={[-0.06, 0.26, -0.16]} rotation={[0.2, 0, 0.35]}>
            <boxGeometry args={[0.016, 0.22, 0.05]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>

          {/* ---------------- head ---------------- */}
          <group ref={(g) => { if (g) parts.current.head = g; }} position={[0, 0.62, 0]}>
            <mesh>
              <sphereGeometry args={[0.155, 28, 24]} />
              <meshStandardMaterial {...GRAPHITE} />
            </mesh>
            {/* jaw wedge */}
            <mesh position={[0, -0.05, 0.03]} rotation={[0.12, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.13, 0.1, 20]} />
              <meshStandardMaterial {...SUIT} />
            </mesh>
            {/* visor */}
            <RoundedBox args={[0.21, 0.075, 0.1]} radius={0.03} smoothness={4} position={[0, 0.022, 0.085]}>
              <meshStandardMaterial
                ref={visorMat}
                color="#0A101C"
                emissive="#22D3EE"
                emissiveIntensity={1.6}
                metalness={0.4}
                roughness={0.25}
              />
            </RoundedBox>
            {/* eyes */}
            <mesh
              position={[-0.045, 0.025, 0.138]}
              ref={(m) => { if (m) parts.current.eyeMeshL = m; }}
            >
              <capsuleGeometry args={[0.011, 0.026, 4, 8]} />
              <meshStandardMaterial
                ref={eyeMatL}
                color="#04070E"
                emissive="#67E8F9"
                emissiveIntensity={2.2}
              />
            </mesh>
            <mesh
              position={[0.045, 0.025, 0.138]}
              ref={(m) => { if (m) parts.current.eyeMeshR = m; }}
            >
              <capsuleGeometry args={[0.011, 0.026, 4, 8]} />
              <meshStandardMaterial
                ref={eyeMatR}
                color="#04070E"
                emissive="#67E8F9"
                emissiveIntensity={2.2}
              />
            </mesh>
            {/* ear pods */}
            <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <mesh position={[-0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            {/* antenna */}
            <mesh position={[0.09, 0.15, -0.02]} rotation={[0, 0, -0.3]}>
              <cylinderGeometry args={[0.006, 0.006, 0.12, 8]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <mesh position={[0.115, 0.215, -0.02]}>
              <sphereGeometry args={[0.014, 12, 12]} />
              <meshStandardMaterial
                ref={registerTrim(1)}
                color="#0E1522"
                emissive="#22D3EE"
                emissiveIntensity={1.1}
                metalness={0.5}
                roughness={0.35}
              />
            </mesh>
          </group>

          {/* ---------------- arms ---------------- */}
          <group position={[-0.245, 0.4, 0]}>
            <mesh>
              <sphereGeometry args={[0.075, 18, 16]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <group ref={(g) => { if (g) parts.current.armL = g; }}>
              <mesh position={[0, -0.12, 0]}>
                <capsuleGeometry args={[0.048, 0.16, 6, 14]} />
                <meshStandardMaterial {...SUIT} />
              </mesh>
              <group ref={(g) => { if (g) parts.current.forearmL = g; }} position={[0, -0.24, 0]}>
                <mesh position={[0, -0.1, 0]}>
                  <capsuleGeometry args={[0.04, 0.14, 6, 14]} />
                  <meshStandardMaterial {...GRAPHITE} />
                </mesh>
                <RoundedBox args={[0.06, 0.07, 0.05]} radius={0.02} smoothness={3} position={[0, -0.21, 0]}>
                  <meshStandardMaterial {...JOINT} />
                </RoundedBox>
              </group>
            </group>
          </group>

          <group position={[0.245, 0.4, 0]}>
            <mesh>
              <sphereGeometry args={[0.075, 18, 16]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <group ref={(g) => { if (g) parts.current.armR = g; }}>
              <mesh position={[0, -0.12, 0]}>
                <capsuleGeometry args={[0.048, 0.16, 6, 14]} />
                <meshStandardMaterial {...SUIT} />
              </mesh>
              <group ref={(g) => { if (g) parts.current.forearmR = g; }} position={[0, -0.24, 0]}>
                <mesh position={[0, -0.1, 0]}>
                  <capsuleGeometry args={[0.04, 0.14, 6, 14]} />
                  <meshStandardMaterial {...GRAPHITE} />
                </mesh>
                <RoundedBox args={[0.06, 0.07, 0.05]} radius={0.02} smoothness={3} position={[0, -0.21, 0]}>
                  <meshStandardMaterial {...JOINT} />
                </RoundedBox>
              </group>
            </group>
          </group>
        </group>

        {/* ---------------- pelvis + legs ---------------- */}
        <RoundedBox args={[0.3, 0.16, 0.2]} radius={0.06} smoothness={4} position={[0, -0.06, 0]}>
          <meshStandardMaterial {...SUIT} />
        </RoundedBox>
        {[-0.1, 0.1].map((x) => (
          <group key={x} position={[x, -0.1, 0]}>
            <mesh position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.055, 0.26, 6, 14]} />
              <meshStandardMaterial {...GRAPHITE} />
            </mesh>
            <mesh position={[0, -0.46, 0.01]}>
              <capsuleGeometry args={[0.047, 0.22, 6, 14]} />
              <meshStandardMaterial {...SUIT} />
            </mesh>
            <RoundedBox args={[0.09, 0.05, 0.16]} radius={0.02} smoothness={3} position={[0, -0.61, 0.03]}>
              <meshStandardMaterial {...JOINT} />
            </RoundedBox>
          </group>
        ))}
      </group>
    </group>
  );
}
