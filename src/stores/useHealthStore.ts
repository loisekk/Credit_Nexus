"use client";

import { create } from "zustand";
import type { HealthResponse } from "@/types/api";
import { onLatency } from "@/services/api";

export type BackendStatus = "checking" | "online" | "degraded" | "offline";

interface HealthState {
  status: BackendStatus;
  ready: boolean;
  artifactKind: string | null;
  loadError: string | null;
  uptimeSeconds: number | null;
  lastCheckedAt: number | null;
  /** Rolling latency samples (ms) — most recent first. */
  latencies: Array<{ ms: number; endpoint: string; at: number }>;
  setHealth: (health: HealthResponse | null) => void;
  recordLatency: (ms: number, endpoint: string) => void;
}

export const useHealthStore = create<HealthState>((set) => ({
  status: "checking",
  ready: false,
  artifactKind: null,
  loadError: null,
  uptimeSeconds: null,
  lastCheckedAt: null,
  latencies: [],
  setHealth: (health) =>
    set(
      health
        ? {
            status: health.ready ? "online" : "degraded",
            ready: health.ready,
            artifactKind: health.artifact_kind,
            loadError: health.load_error,
            uptimeSeconds: health.uptime_seconds,
            lastCheckedAt: Date.now(),
          }
        : {
            status: "offline",
            ready: false,
            lastCheckedAt: Date.now(),
          }
    ),
  recordLatency: (ms, endpoint) =>
    set((state) => ({
      latencies: [{ ms: Math.round(ms), endpoint, at: Date.now() }, ...state.latencies].slice(
        0,
        40
      ),
    })),
}));

// Wire the API client's latency signal into the store (module side-effect, once).
if (typeof window !== "undefined") {
  onLatency((ms, endpoint) => useHealthStore.getState().recordLatency(ms, endpoint));
}

/** Exponential moving average of recent latencies, or null when empty. */
export function emaLatency(latencies: Array<{ ms: number }>): number | null {
  if (latencies.length === 0) return null;
  const alpha = 0.35;
  let ema = latencies[latencies.length - 1].ms;
  for (let i = latencies.length - 2; i >= 0; i--) {
    ema = alpha * latencies[i].ms + (1 - alpha) * ema;
  }
  return Math.round(ema);
}
