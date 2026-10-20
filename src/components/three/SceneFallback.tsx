"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import { useCharacterStore, CHARACTER_STATE_META } from "@/stores/useCharacterStore";

/**
 * Non-WebGL / reduced-motion view of NEXUS. The workstation stays fully
 * functional — only the 3D presentation is replaced.
 */
export function SceneFallback({ reason }: { reason: "webgl" | "crash" | "reduced" }) {
  const state = useCharacterStore((s) => s.state);
  const meta = CHARACTER_STATE_META[state];
  const tone =
    state === "highRisk"
      ? "text-nexus-amber"
      : state === "error"
        ? "text-nexus-red"
        : state === "lowRisk"
          ? "text-nexus-emerald"
          : "text-nexus-cyan";

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-nexus-void">
      <div className="nexus-grid-bg absolute inset-0 opacity-60" />
      <div className="nexus-radial-fade absolute inset-0" />
      {/* stylized NEXUS sigil */}
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-nexus-line" />
        <div className="absolute inset-4 rounded-full border border-nexus-line-strong" />
        <div className="absolute inset-8 rounded-full border border-nexus-cyan/25" />
        <Sparkles className={`h-10 w-10 ${tone}`} aria-hidden />
      </div>
      <p className="mt-6 text-sm font-medium text-nexus-dim">
        NEXUS · <span className={tone}>{meta.label}</span>
      </p>
      <p className="mt-1 max-w-xs text-center text-xs text-nexus-faint">
        {reason === "webgl"
          ? "3D view is unavailable on this device — the analyst and all analysis features remain fully functional."
          : reason === "crash"
            ? "The 3D view could not be rendered — all analysis features remain fully functional."
            : "Low-performance view active."}
      </p>
      {reason !== "reduced" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-nexus-line bg-nexus-panel px-3 py-1 text-[11px] text-nexus-faint">
          <TriangleAlert className="h-3 w-3" aria-hidden />
          {reason === "webgl" ? "WebGL not detected" : "3D renderer stopped"}
        </p>
      )}
    </div>
  );
}
