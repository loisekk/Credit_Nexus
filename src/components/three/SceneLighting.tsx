"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PoseRuntime } from "./poseEngine";

/** State-reactive lighting: soft key + ambient base, animated character rim. */
export function SceneLighting({ pose }: { pose: PoseRuntime }) {
  const rim = useRef<THREE.SpotLight>(null);
  const rimColor = useRef(new THREE.Color("#38BDF8"));

  useFrame((_, delta) => {
    rimColor.current.lerp(pose.rimColor, Math.min(1, 3.5 * Math.min(delta, 0.05)));
    if (rim.current) {
      rim.current.color.copy(rimColor.current);
      rim.current.intensity = pose.rimIntensity * 2.4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} color="#93B4D8" />
      <directionalLight position={[2.6, 3.6, 3.2]} intensity={1.05} color="#D6E9FF" />
      <directionalLight position={[-2.2, 2.4, 1.5]} intensity={0.35} color="#8B5CF6" />
      <spotLight
        ref={rim}
        position={[-3.1, 2.7, -2.6]}
        angle={0.62}
        penumbra={0.85}
        distance={14}
        intensity={14}
        color="#38BDF8"
      />
      {/* console accent + platform under-glow */}
      <pointLight position={[0, 1.25, 0.9]} intensity={1.6} color="#38BDF8" distance={2.6} />
      <pointLight position={[0, 0.2, 0]} intensity={1.1} color="#8B5CF6" distance={2.4} />
    </>
  );
}
