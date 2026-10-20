/**
 * NEXUS pose engine — maps character FSM states to animated pose targets.
 *
 * Pure logic (no React): CharacterController calls computePose() every frame;
 * NexusCharacter / environment / lighting read the resulting mutable runtime.
 * Damped interpolation makes every transition interruptible by design.
 */
import { Color } from "three";
import type { CharacterState } from "@/stores/useCharacterStore";

export interface PoseTargets {
  headYaw: number;
  headPitch: number;
  torsoLean: number;
  torsoTwist: number;
  armRaiseL: number;
  armRaiseR: number;
  elbowL: number;
  elbowR: number;
  visorColor: string;
  visorIntensity: number;
  coreIntensity: number;
  rimColor: string;
  rimIntensity: number;
  ringColor: string;
  ringIntensity: number;
  scan: number;
  breath: number;
}

export interface PoseRuntime {
  state: CharacterState;
  stateAt: number;
  headYaw: number;
  headPitch: number;
  torsoLean: number;
  torsoTwist: number;
  armRaiseL: number;
  armRaiseR: number;
  elbowL: number;
  elbowR: number;
  visorColor: Color;
  visorIntensity: number;
  coreIntensity: number;
  rimColor: Color;
  rimIntensity: number;
  ringColor: Color;
  ringIntensity: number;
  scan: number;
  breath: number;
}

const BASE: PoseTargets = {
  headYaw: 0,
  headPitch: 0.02,
  torsoLean: 0,
  torsoTwist: 0,
  armRaiseL: 0.06,
  armRaiseR: 0.06,
  elbowL: 0.18,
  elbowR: 0.18,
  visorColor: "#22D3EE",
  visorIntensity: 1.6,
  coreIntensity: 1.2,
  rimColor: "#38BDF8",
  rimIntensity: 6,
  ringColor: "#22D3EE",
  ringIntensity: 1.4,
  scan: 0,
  breath: 1,
};

/** Per-state pose targets. */
export const POSES: Record<CharacterState, PoseTargets> = {
  idle: { ...BASE },
  greeting: {
    ...BASE,
    headPitch: 0.08,
    armRaiseR: 0.6,
    elbowR: 0.3,
    visorColor: "#67E8F9",
    visorIntensity: 2.2,
    ringIntensity: 2.0,
  },
  listening: {
    ...BASE,
    headYaw: 0.38,
    headPitch: 0.06,
    torsoTwist: 0.12,
    torsoLean: 0.03,
    armRaiseR: 0.16,
    visorColor: "#38BDF8",
    visorIntensity: 1.8,
  },
  analyzing: {
    ...BASE,
    headPitch: 0.14,
    torsoLean: 0.1,
    armRaiseL: 0.62,
    armRaiseR: 0.62,
    elbowL: 0.5,
    elbowR: 0.5,
    visorColor: "#8B5CF6",
    visorIntensity: 2.0,
    coreIntensity: 2.0,
    rimColor: "#8B5CF6",
    rimIntensity: 8,
    ringColor: "#8B5CF6",
    ringIntensity: 1.8,
    scan: 1,
    breath: 0.6,
  },
  lowRisk: {
    ...BASE,
    headPitch: -0.03,
    visorColor: "#34D399",
    visorIntensity: 1.8,
    rimColor: "#34D399",
    rimIntensity: 6,
    ringColor: "#34D399",
    ringIntensity: 1.5,
  },
  highRisk: {
    ...BASE,
    headPitch: 0.05,
    visorColor: "#F5A623",
    visorIntensity: 2.4,
    coreIntensity: 1.6,
    rimColor: "#F87171",
    rimIntensity: 9,
    ringColor: "#F5A623",
    ringIntensity: 2.0,
    breath: 1.15,
  },
  error: {
    ...BASE,
    headPitch: 0.3,
    armRaiseL: 0.02,
    armRaiseR: 0.02,
    elbowL: 0.06,
    elbowR: 0.06,
    visorColor: "#F87171",
    visorIntensity: 1.6,
    rimColor: "#F87171",
    rimIntensity: 5,
    ringColor: "#F87171",
    ringIntensity: 1.2,
    breath: 0.5,
  },
  explaining: {
    ...BASE,
    headYaw: -0.45,
    armRaiseR: 0.82,
    elbowR: 0.32,
    visorColor: "#22D3EE",
    visorIntensity: 1.9,
    ringIntensity: 1.5,
  },
};

const _colorScratch = {
  visor: new Color(),
  rim: new Color(),
  ring: new Color(),
};

function damp(current: number, target: number, lambda: number, delta: number): number {
  const t = 1 - Math.exp(-lambda * delta);
  return current + (target - current) * Math.min(1, Math.max(0, t));
}

function dampColor(
  current: Color,
  targetHex: string,
  lambda: number,
  delta: number
): void {
  _colorScratch.visor.set(targetHex); // reuse one scratch per call site below
  current.lerp(_colorScratch.visor, Math.min(1, lambda * delta));
}

export function createPoseRuntime(): PoseRuntime {
  return {
    state: "idle",
    stateAt: 0,
    headYaw: 0,
    headPitch: 0.02,
    torsoLean: 0,
    torsoTwist: 0,
    armRaiseL: 0.06,
    armRaiseR: 0.06,
    elbowL: 0.18,
    elbowR: 0.18,
    visorColor: new Color(BASE.visorColor),
    visorIntensity: BASE.visorIntensity,
    coreIntensity: BASE.coreIntensity,
    rimColor: new Color(BASE.rimColor),
    rimIntensity: BASE.rimIntensity,
    ringColor: new Color(BASE.ringColor),
    ringIntensity: BASE.ringIntensity,
    scan: 0,
    breath: 1,
  };
}

/**
 * App-wide pose runtime. NEXUS is a single instance, so the animation state
 * lives at module scope — outside React's render cycle entirely (written only
 * from effects/frame callbacks, read by the scene each frame).
 */
export const sharedPoseRuntime: PoseRuntime = createPoseRuntime();

/**
 * Advance the pose runtime one frame.
 * @param pose       mutable runtime (mutated in place)
 * @param delta      frame delta seconds
 * @param elapsed    total clock seconds
 * @param stateElapsed seconds since the current state was entered
 * @param reducedMotion disables continuous idle motion
 */
export function computePose(
  pose: PoseRuntime,
  delta: number,
  elapsed: number,
  stateElapsed: number,
  reducedMotion: boolean
): void {
  const targets: PoseTargets = { ...POSES[pose.state] };
  const s = stateElapsed;

  // ---- transient behavior overlays --------------------------------------
  switch (pose.state) {
    case "greeting": {
      if (s < 2.4) {
        targets.armRaiseR += Math.sin(s * 5) * 0.12 + 0.12;
        targets.headPitch += Math.sin(s * 3) * 0.045;
      }
      break;
    }
    case "highRisk": {
      if (s < 1.6) {
        targets.headYaw += Math.sin(s * 10) * 0.14 * (1 - s / 1.6);
        targets.visorIntensity += Math.sin(s * 8) * 0.3 * (1 - s / 1.6);
      }
      break;
    }
    case "error": {
      targets.visorIntensity *= Math.sin(s * 7) > 0 ? 1 : 0.2;
      break;
    }
    case "analyzing": {
      targets.headPitch += Math.sin(s * 2.2) * 0.02;
      break;
    }
    case "idle": {
      if (!reducedMotion) {
        targets.headYaw += Math.sin(elapsed * 0.35) * 0.07;
        targets.headPitch += Math.sin(elapsed * 0.23) * 0.015;
      }
      break;
    }
    default:
      break;
  }

  // ---- damped interpolation ---------------------------------------------
  const k = 5.5;
  const ck = 4.5;
  pose.headYaw = damp(pose.headYaw, targets.headYaw, k, delta);
  pose.headPitch = damp(pose.headPitch, targets.headPitch, k, delta);
  pose.torsoLean = damp(pose.torsoLean, targets.torsoLean, k, delta);
  pose.torsoTwist = damp(pose.torsoTwist, targets.torsoTwist, k, delta);
  pose.armRaiseL = damp(pose.armRaiseL, targets.armRaiseL, k, delta);
  pose.armRaiseR = damp(pose.armRaiseR, targets.armRaiseR, k, delta);
  pose.elbowL = damp(pose.elbowL, targets.elbowL, k, delta);
  pose.elbowR = damp(pose.elbowR, targets.elbowR, k, delta);
  pose.visorIntensity = damp(pose.visorIntensity, targets.visorIntensity, ck, delta);
  pose.coreIntensity = damp(pose.coreIntensity, targets.coreIntensity, ck, delta);
  pose.rimIntensity = damp(pose.rimIntensity, targets.rimIntensity, ck, delta);
  pose.ringIntensity = damp(pose.ringIntensity, targets.ringIntensity, ck, delta);
  pose.scan = damp(pose.scan, targets.scan, ck, delta);
  pose.breath = damp(pose.breath, targets.breath, ck, delta);

  dampColor(pose.visorColor, targets.visorColor, ck, delta);
  dampColor(pose.rimColor, targets.rimColor, ck, delta);
  dampColor(pose.ringColor, targets.ringColor, ck, delta);
}
