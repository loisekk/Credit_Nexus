"use client";

import { useEffect } from "react";
import {
  ArrowRight,
  CircleAlert,
  FlaskConical,
  Gauge,
  RotateCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { ProbabilityBar } from "@/components/charts/ProbabilityBar";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useViewStore } from "@/stores/useViewStore";
import { fmtLatency, fmtPercent, fmtProbability, riskWording } from "@/utils/format";
import { DISCLOSURE } from "@/config/modelFacts";
import { cn } from "@/lib/utils";
import type { CreditRiskResult } from "@/types/api";

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-nexus-line bg-nexus-panel">
        <Gauge className="h-7 w-7 text-nexus-faint" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-nexus-dim">No analysis yet</p>
        <p className="mx-auto max-w-[220px] text-xs leading-relaxed text-nexus-faint">
          Complete the applicant profile and NEXUS will query the risk model in
          real time.
        </p>
      </div>
    </div>
  );
}

function AnalyzingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8" role="status" aria-live="polite">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full border border-nexus-violet/30" />
        <span className="absolute inset-2 animate-pulse rounded-full border border-nexus-cyan/40" />
        <ScanLine className="h-8 w-8 animate-pulse text-nexus-violet" aria-hidden />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-nexus-text">NEXUS is analyzing</p>
        <p className="font-mono text-[11px] text-nexus-faint">
          querying the calibrated XGBoost · awaiting live response
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-nexus-red/30 bg-nexus-red/10">
        <CircleAlert className="h-6 w-6 text-nexus-red" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-nexus-text">Analysis failed</p>
        <p className="mx-auto max-w-[260px] text-xs leading-relaxed text-nexus-faint">{message}</p>
      </div>
      <Button
        size="sm"
        onClick={onRetry}
        className="gap-1.5 border-nexus-line bg-nexus-panel text-nexus-text hover:bg-nexus-raised"
        variant="outline"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        Retry request
      </Button>
    </div>
  );
}

function SuccessState({ result, latencyMs }: { result: CreditRiskResult; latencyMs: number | null }) {
  const high = result.default_prediction === 1;
  const setView = useViewStore((s) => s.setView);
  const setExplainFocus = useViewStore((s) => s.setExplainFocus);
  const setState = useCharacterStore((s) => s.setState);

  return (
    <div className="space-y-5 p-4 sm:p-5">
      {/* headline */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-nexus-faint">
            model assessment
          </p>
          <p
            className={cn(
              "mt-1 text-base font-semibold",
              high ? "text-nexus-amber" : "text-nexus-emerald"
            )}
          >
            {riskWording(result.default_prediction)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-nexus-faint">
            {latencyMs !== null ? `response in ${fmtLatency(latencyMs)}` : "\u00A0"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold",
            high
              ? "border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber"
              : "border-nexus-emerald/40 bg-nexus-emerald/10 text-nexus-emerald"
          )}
        >
          {result.Result}
        </span>
      </div>

      <RiskGauge
        probability={result.default_probability}
        threshold={result.threshold}
        prediction={result.default_prediction}
      />

      <ProbabilityBar probability={result.default_probability} threshold={result.threshold} />

      {/* classification rule with actual numbers */}
      <div className="rounded-xl border border-nexus-line bg-nexus-panel/50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-nexus-faint">
          classification rule
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-nexus-dim">
          <span className={high ? "text-nexus-amber" : "text-nexus-emerald"}>
            {fmtProbability(result.default_probability)}
          </span>
          <span className="text-nexus-faint"> {" "}({fmtPercent(result.default_probability)}){" "} </span>
          {high ? (
            <span className="text-nexus-amber">≥</span>
          ) : (
            <span className="text-nexus-emerald">&lt;</span>
          )}
          <span className="text-nexus-amber"> {fmtProbability(result.threshold)} </span>
          <span className="text-nexus-faint">({fmtPercent(result.threshold)}) threshold</span>
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-nexus-faint">
          predicted class <span className="font-mono text-nexus-dim">{result.default_prediction}</span>{" "}
          — the model estimates {high ? "elevated" : "lower"} probability of loan default.
          This is <span className="text-nexus-dim">not</span> the probability that the
          classification is correct.
        </p>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5 border-nexus-line bg-nexus-panel text-nexus-cyan hover:bg-nexus-raised hover:text-nexus-cyan-soft"
          onClick={() => {
            setState("explaining");
            setExplainFocus("local");
            setView("explainability");
          }}
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Explain this result
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>

      <p className="flex items-start gap-2 border-t border-nexus-line pt-3 text-[10px] leading-relaxed text-nexus-faint">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-nexus-emerald/60" aria-hidden />
        {DISCLOSURE}
      </p>
    </div>
  );
}

export function ResultsPanel({
  onRetry,
}: {
  onRetry: (input: import("@/types/api").CreditRiskInput) => void;
}) {
  const status = useAnalysisStore((s) => s.status);
  const result = useAnalysisStore((s) => s.result);
  const error = useAnalysisStore((s) => s.error);
  const input = useAnalysisStore((s) => s.input);
  const latencyMs = useAnalysisStore((s) => s.latencyMs);

  // Keep the character in sync with panel state (defensive; analysis flow
  // already drives it, this guarantees consistency on remount).
  useEffect(() => {
    if (status === "success" && result) {
      useCharacterStore.getState().setState(result.default_prediction === 1 ? "highRisk" : "lowRisk");
    }
  }, [status, result]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto nexus-scroll">
      {status === "idle" && <EmptyState />}
      {status === "analyzing" && <AnalyzingState />}
      {status === "error" && (
        <ErrorState message={error ?? "Unknown error"} onRetry={() => input && onRetry(input)} />
      )}
      {status === "success" && result && <SuccessState result={result} latencyMs={latencyMs} />}
    </div>
  );
}
