"use client";

import { create } from "zustand";

export type ViewId = "welcome" | "analysis" | "explainability" | "observatory";

interface ViewState {
  view: ViewId;
  paletteOpen: boolean;
  timelineOpen: boolean;
  /** Initial tab for the Explainability Lab (set by "Explain this result"). */
  explainFocus: "global" | "local" | null;
  /** Character scene layout mode derived from the active view. */
  sceneMode: "hero" | "workspace" | "compact";
  setView: (view: ViewId) => void;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setTimelineOpen: (open: boolean) => void;
  toggleTimeline: () => void;
  setExplainFocus: (focus: "global" | "local" | null) => void;
}

const SCENE_MODES: Record<ViewId, ViewState["sceneMode"]> = {
  welcome: "hero",
  analysis: "workspace",
  explainability: "compact",
  observatory: "compact",
};

export const useViewStore = create<ViewState>((set) => ({
  view: "welcome",
  paletteOpen: false,
  timelineOpen: false,
  explainFocus: null,
  sceneMode: "hero",
  setView: (view) =>
    set((state) =>
      state.view === view
        ? {}
        : { view, sceneMode: SCENE_MODES[view], paletteOpen: false }
    ),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setTimelineOpen: (timelineOpen) => set({ timelineOpen }),
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
  setExplainFocus: (explainFocus) => set({ explainFocus }),
}));

export const VIEW_META: Record<ViewId, { label: string; hint: string }> = {
  welcome: { label: "Overview", hint: "Welcome and model summary" },
  analysis: { label: "Analysis", hint: "Run a risk analysis" },
  explainability: { label: "Explainability", hint: "Explore why the model decides" },
  observatory: { label: "Observatory", hint: "Model health and metadata" },
};
