"use client";

import { create } from "zustand";

/**
 * Finite-state machine for NEXUS, the 3D AI analyst.
 *
 * States communicate APPLICATION truth only (form interaction, API state).
 * The character never invents or alters prediction results.
 */
export type CharacterState =
  | "idle"
  | "greeting"
  | "listening"
  | "analyzing"
  | "lowRisk"
  | "highRisk"
  | "error"
  | "explaining";

export const CHARACTER_STATE_META: Record<
  CharacterState,
  { label: string; caption: string }
> = {
  idle: { label: "Standby", caption: "NEXUS is monitoring the workstation" },
  greeting: { label: "Greeting", caption: "NEXUS welcomes you" },
  listening: { label: "Listening", caption: "NEXUS is attending to your inputs" },
  analyzing: { label: "Analyzing", caption: "NEXUS is querying the risk model" },
  lowRisk: { label: "Assessed", caption: "Lower predicted default risk" },
  highRisk: { label: "Alert", caption: "Higher predicted default risk" },
  error: { label: "Fault", caption: "The request could not be completed" },
  explaining: { label: "Explaining", caption: "NEXUS is walking through the evidence" },
};

interface CharacterStateStore {
  state: CharacterState;
  /** Timestamp (ms) of the last greeting — used to greet only once per session. */
  greetedAt: number | null;
  visible: boolean;
  reducedMotion: boolean;
  /** Incremented by the Reset camera action; the rig watches this. */
  cameraResetSignal: number;
  setState: (state: CharacterState) => void;
  /** Only downgrades transient states — never interrupts result/error states. */
  setSoftState: (state: CharacterState) => void;
  markGreeted: () => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  setReducedMotion: (reduced: boolean) => void;
  resetCamera: () => void;
}

const SOFT_STATES: CharacterState[] = ["idle", "listening", "greeting"];

export const useCharacterStore = create<CharacterStateStore>((set, get) => ({
  state: "idle",
  greetedAt: null,
  visible: true,
  reducedMotion: false,
  cameraResetSignal: 0,
  setState: (state) => set({ state }),
  setSoftState: (state) => {
    const current = get().state;
    if (SOFT_STATES.includes(current)) set({ state });
  },
  markGreeted: () => set({ greetedAt: Date.now() }),
  setVisible: (visible) => set({ visible }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  resetCamera: () => set((s) => ({ cameraResetSignal: s.cameraResetSignal + 1 })),
}));
