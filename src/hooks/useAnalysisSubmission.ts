"use client";

import { useCallback } from "react";
import { predictCreditRisk } from "@/services/api";
import { ApiError, type CreditRiskInput } from "@/types/api";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useTimelineStore } from "@/stores/useTimelineStore";

/**
 * The single prediction flow:
 * validate → character `analyzing` → real POST /predict → validate response →
 * character result state + timeline entry. No fabricated delays; the model is
 * the only source of the numbers.
 */
export function useAnalysisSubmission() {
  const submit = useCallback(async (input: CreditRiskInput) => {
    const { begin, succeed, fail } = useAnalysisStore.getState();
    const seq = begin(input);
    useCharacterStore.getState().setState("analyzing");
    useTimelineStore
      .getState()
      .push("submit", "Analysis submitted", "POST /predict — awaiting live response");

    const started = performance.now();
    try {
      const { promise } = predictCreditRisk(input);
      const result = await promise;
      const latencyMs = performance.now() - started;
      succeed(result, latencyMs, seq);
      useCharacterStore
        .getState()
        .setState(result.default_prediction === 1 ? "highRisk" : "lowRisk");
      useTimelineStore.getState().push(
        "result",
        `${result.Result} — ${(result.default_probability * 100).toFixed(2)}% default probability`,
        `classified against threshold ${(result.threshold * 100).toFixed(2)}% · ${Math.round(latencyMs)} ms`
      );
      // Return NEXUS to standby a while after showing the outcome.
      window.setTimeout(() => {
        const s = useCharacterStore.getState().state;
        if (s === "lowRisk" || s === "highRisk") {
          useCharacterStore.getState().setState("idle");
        }
      }, 6000);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "The prediction request failed.";
      const code = cause instanceof ApiError ? cause.code : "UNKNOWN";
      fail(message, code, seq);
      useCharacterStore.getState().setState("error");
      useTimelineStore.getState().push("error", "Analysis failed", message);
    }
  }, []);

  return { submit };
}
