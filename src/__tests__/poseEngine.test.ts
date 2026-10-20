import { describe, expect, it } from "vitest";
import { computePose, createPoseRuntime, POSES } from "@/components/three/poseEngine";

describe("pose engine (character FSM)", () => {
  it("defines targets for every character state", () => {
    const states = [
      "idle", "greeting", "listening", "analyzing",
      "lowRisk", "highRisk", "error", "explaining",
    ] as const;
    for (const s of states) {
      expect(POSES[s], `missing pose for ${s}`).toBeDefined();
    }
  });

  it("uses emerald palette for low risk and amber/red for high risk", () => {
    expect(POSES.lowRisk.visorColor).toBe("#34D399");
    expect(POSES.highRisk.rimColor).toBe("#F87171");
    expect(POSES.highRisk.ringColor).toBe("#F5A623");
  });

  it("analyzing enables the scan effect; idle does not", () => {
    expect(POSES.analyzing.scan).toBe(1);
    expect(POSES.idle.scan).toBe(0);
  });

  it("damps toward targets and is interruptible mid-transition", () => {
    const pose = createPoseRuntime();
    pose.state = "analyzing";
    pose.stateAt = 0;
    // run several frames toward analyzing
    for (let i = 0; i < 60; i++) computePose(pose, 1 / 60, i / 60, 1, false);
    expect(pose.scan).toBeGreaterThan(0.5);
    const scanMidTransition = pose.scan;

    // interrupt with error state — must immediately head toward error targets
    pose.state = "error";
    pose.stateAt = 100;
    computePose(pose, 1 / 60, 2, 0, false);
    expect(pose.scan).toBeLessThan(scanMidTransition);
    for (let i = 0; i < 120; i++) computePose(pose, 1 / 60, 3, i / 30, false);
    expect(pose.scan).toBeLessThan(0.05);
    expect(pose.headPitch).toBeGreaterThan(0.2);
  });

  it("keeps all pose values within physical bounds", () => {
    const pose = createPoseRuntime();
    for (const state of Object.keys(POSES) as Array<keyof typeof POSES>) {
      pose.state = state;
      pose.stateAt = 0;
      for (let i = 0; i < 120; i++) computePose(pose, 1 / 60, i / 60, i / 60, false);
      expect(Math.abs(pose.headYaw)).toBeLessThanOrEqual(Math.PI / 2 + 0.1);
      expect(Math.abs(pose.headPitch)).toBeLessThanOrEqual(Math.PI / 3);
      expect(pose.armRaiseL).toBeGreaterThanOrEqual(0);
      expect(pose.armRaiseL).toBeLessThanOrEqual(1.5);
      expect(pose.visorIntensity).toBeGreaterThanOrEqual(0);
      expect(pose.ringIntensity).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(pose.scan)).toBe(true);
    }
  });

  it("suppresses idle head wander under reduced motion", () => {
    const withMotion = createPoseRuntime();
    const reduced = createPoseRuntime();
    for (const pose of [withMotion, reduced]) {
      pose.state = "idle";
      pose.stateAt = 0;
    }
    for (let i = 0; i < 300; i++) {
      computePose(withMotion, 1 / 60, i / 60, 30, false);
      computePose(reduced, 1 / 60, i / 60, 30, true);
    }
    expect(Math.abs(withMotion.headYaw)).toBeGreaterThan(0.01);
    expect(Math.abs(reduced.headYaw)).toBeLessThan(0.01);
  });
});
