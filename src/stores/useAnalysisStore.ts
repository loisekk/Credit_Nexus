"use client";

import { create } from "zustand";
import type { CreditRiskInput, CreditRiskResult } from "@/types/api";

export type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

export interface AnalysisHistoryEntry {
  input: CreditRiskInput;
  result: CreditRiskResult;
  at: number;
  latencyMs: number | null;
}

interface AnalysisState {
  status: AnalysisStatus;
  /** Sequence of the most recent submission (stale-response guard). */
  seq: number;
  input: CreditRiskInput | null;
  result: CreditRiskResult | null;
  error: string | null;
  errorCode: string | null;
  latencyMs: number | null;
  history: AnalysisHistoryEntry[];
  begin: (input: CreditRiskInput) => number;
  succeed: (result: CreditRiskResult, latencyMs: number | null, seq: number) => void;
  fail: (message: string, code: string | null, seq: number) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  status: "idle",
  seq: 0,
  input: null,
  result: null,
  error: null,
  errorCode: null,
  latencyMs: null,
  history: [],
  begin: (input) => {
    const seq = useAnalysisStore.getState().seq + 1;
    set({
      status: "analyzing",
      input,
      seq,
      result: null,
      error: null,
      errorCode: null,
      latencyMs: null,
    });
    return seq;
  },
  succeed: (result, latencyMs, seq) =>
    set((state) => {
      if (seq !== state.seq) return state; // stale response — discard
      const history: AnalysisHistoryEntry[] = state.input
        ? [
            { input: state.input, result, at: Date.now(), latencyMs },
            ...state.history,
          ].slice(0, 12)
        : state.history;
      return { status: "success", result, latencyMs, history, error: null, errorCode: null };
    }),
  fail: (message, code, seq) =>
    set((state) =>
      seq !== state.seq
        ? state
        : { status: "error", error: message, errorCode: code, result: null, latencyMs: null }
    ),
  reset: () =>
    set({
      status: "idle",
      input: null,
      result: null,
      error: null,
      errorCode: null,
      latencyMs: null,
    }),
}));
