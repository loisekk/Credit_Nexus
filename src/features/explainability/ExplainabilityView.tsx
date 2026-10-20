"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  FlaskConical,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Waves,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImportanceChart } from "@/components/charts/ImportanceChart";
import { SensitivityChart, type SensitivityPoint } from "@/components/charts/SensitivityChart";
import { explainPrediction, fetchFeatureImportance, predictCreditRisk } from "@/services/api";
import { ApiError, type ExplainResponse, type FeatureImportanceResponse } from "@/types/api";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useViewStore } from "@/stores/useViewStore";
import { TRAINING_RANGES, type NumericFeature } from "@/schemas/creditRisk";
import { fmtPercent, fmtProbability } from "@/utils/format";
import { cn } from "@/lib/utils";

const NUMERIC_FEATURES = Object.keys(TRAINING_RANGES) as NumericFeature[];
const SWEEP_POINTS = 9;

function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-nexus-line bg-nexus-panel/40 p-3 text-[11px] leading-relaxed text-nexus-faint">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nexus-cyan/70" aria-hidden />
      {children}
    </p>
  );
}

function GlobalImportancePanel() {
  const [data, setData] = useState<FeatureImportanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchFeatureImportance(controller.signal)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 0 && controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load importance");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-nexus-faint">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading gain importance from the model…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-nexus-red/30 bg-nexus-red/5 p-4 text-xs text-nexus-red">
        {error ?? "Feature importance is not available."}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ImportanceChart features={data.features} />
      <SourceNote>
        <span>
          <span className="text-nexus-dim">True model explanation:</span> gain-based
          importance of the serving XGBoost ({data.importance_type}), aggregated from
          one-hot encoded columns back to the 11 original applicant features.
          Values are read from the fitted estimator — nothing is estimated.
        </span>
      </SourceNote>
    </div>
  );
}

function LocalExplanationPanel() {
  const input = useAnalysisStore((s) => s.input);
  const setView = useViewStore((s) => s.setView);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const explain = useCallback(async () => {
    if (!input) return;
    setLoading(true);
    setError(null);
    try {
      const result = await explainPrediction(input);
      setExplanation(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Explanation failed");
    } finally {
      setLoading(false);
    }
  }, [input]);

  useEffect(() => {
    if (input) void explain();
  }, [input, explain]);

  if (!input) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-nexus-line py-16 text-center">
        <FlaskConical className="h-7 w-7 text-nexus-faint" aria-hidden />
        <p className="max-w-xs text-xs leading-relaxed text-nexus-faint">
          Run an analysis first — the local explanation is computed for the most
          recent submitted applicant profile.
        </p>
        <Button
          size="sm"
          onClick={() => setView("analysis")}
          className="bg-gradient-to-r from-nexus-cyan to-nexus-blue text-xs font-semibold text-nexus-void hover:brightness-110"
        >
          Go to analysis
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-nexus-faint">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Computing SHAP contributions for the submitted profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-nexus-red/30 bg-nexus-red/5 p-4 text-xs text-nexus-red">
        {error}
      </div>
    );
  }

  if (!explanation) return null;
  const maxAbs = Math.max(...explanation.contributions.map((c) => Math.abs(c.contribution)), 1e-6);
  const prediction = explanation.prediction;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-nexus-line bg-nexus-panel/50 px-4 py-3">
        <p className="text-xs text-nexus-dim">
          Submitted profile · predicted probability{" "}
          <span className="font-mono text-nexus-text">
            {fmtProbability(prediction.default_probability)}
          </span>
        </p>
        <p className="font-mono text-[11px] text-nexus-faint">
          base value {fmtProbability(explanation.base_value, 3)} (log-odds)
        </p>
      </div>

      {/* diverging contribution bars */}
      <ul className="space-y-1.5">
        {explanation.contributions.map((c) => {
          const width = (Math.abs(c.contribution) / maxAbs) * 50;
          const positive = c.contribution >= 0;
          return (
            <li key={c.feature} className="grid grid-cols-[130px_1fr_64px] items-center gap-2">
              <span className="truncate text-[11px] text-nexus-dim" title={c.feature}>
                {c.label}
              </span>
              <div className="relative h-4">
                <div className="absolute inset-y-0 left-1/2 w-px bg-nexus-line-strong" />
                <div
                  className={cn(
                    "absolute inset-y-0 rounded-sm transition-all duration-500",
                    positive ? "bg-nexus-red/70" : "bg-nexus-cyan/70"
                  )}
                  style={
                    positive
                      ? { left: "50%", width: `${width}%` }
                      : { right: "50%", width: `${width}%` }
                  }
                />
              </div>
              <span
                className={cn(
                  "text-right font-mono text-[10px]",
                  positive ? "text-nexus-red" : "text-nexus-cyan"
                )}
              >
                {c.contribution >= 0 ? "+" : ""}
                {c.contribution.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between px-1 text-[10px] text-nexus-faint">
        <span>◀ reduces default risk</span>
        <span>increases default risk ▶</span>
      </div>

      <SourceNote>
        <span>
          <span className="text-nexus-dim">SHAP TreeExplainer</span> on the underlying
          uncalibrated XGBoost pipeline — the same methodology as the development
          notebook. Contributions are in log-odds margin space: they show the
          direction and relative magnitude of each feature&apos;s influence, not an
          additive decomposition of the calibrated probability.
        </span>
      </SourceNote>
    </div>
  );
}

function SensitivityLabPanel() {
  const input = useAnalysisStore((s) => s.input);
  const liveThreshold = useAnalysisStore((s) => s.result?.threshold) ?? 0.7158444761787314;
  const setView = useViewStore((s) => s.setView);
  const [feature, setFeature] = useState<NumericFeature>("loan_int_rate");
  const [points, setPoints] = useState<SensitivityPoint[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const range = TRAINING_RANGES[feature];
  const featureLabel = feature
    .replace(/_/g, " ")
    .replace("person ", "")
    .replace("cb person ", "");

  const runSweep = useCallback(async () => {
    if (!input) return;
    cancelRef.current = false;
    setRunning(true);
    setError(null);
    setPoints(null);
    setProgress(0);
    const values = Array.from({ length: SWEEP_POINTS }, (_, i) => {
      const t = i / (SWEEP_POINTS - 1);
      const raw = range.min + t * (range.max - range.min);
      const decimals = range.max <= 1 ? 2 : range.max <= 100 ? 1 : 0;
      return Number(raw.toFixed(decimals));
    });
    const collected: SensitivityPoint[] = [];
    try {
      for (const value of values) {
        if (cancelRef.current) return;
        const payload = { ...input, [feature]: value };
        const { promise } = predictCreditRisk(payload);
        const result = await promise;
        collected.push({ value, probability: result.default_probability });
        setPoints([...collected]);
        setProgress(Math.round(((collected.length) / values.length) * 100));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sweep failed");
    } finally {
      setRunning(false);
    }
  }, [input, feature, range]);

  useEffect(() => () => { cancelRef.current = true; }, []);

  const baseline = useMemo(() => {
    if (!input || !points) return null;
    const base = Number(input[feature]);
    const nearest = points.reduce((a, b) =>
      Math.abs(b.value - base) < Math.abs(a.value - base) ? b : a
    );
    return { value: nearest.value, probability: nearest.probability };
  }, [input, points, feature]);

  if (!input) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-nexus-line py-16 text-center">
        <Waves className="h-7 w-7 text-nexus-faint" aria-hidden />
        <p className="max-w-xs text-xs leading-relaxed text-nexus-faint">
          Sensitivity experiments vary one input at a time and submit a new real
          prediction for each value. Run an analysis first to establish a base
          profile.
        </p>
        <Button
          size="sm"
          onClick={() => setView("analysis")}
          className="bg-gradient-to-r from-nexus-cyan to-nexus-blue text-xs font-semibold text-nexus-void hover:brightness-110"
        >
          Go to analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="sweep-feature" className="text-[11px] font-medium text-nexus-dim">
            Feature to vary
          </label>
          <Select value={feature} onValueChange={(v) => setFeature(v as NumericFeature)}>
            <SelectTrigger id="sweep-feature" className="h-9 w-56 border-nexus-line bg-nexus-deep text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-nexus-line bg-nexus-deep">
              {NUMERIC_FEATURES.map((f) => (
                <SelectItem key={f} value={f} className="text-xs focus:bg-nexus-raised">
                  {f.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="font-mono text-[10px] text-nexus-faint">
          sweep {range.min} → {range.max} · {SWEEP_POINTS} real predictions
        </p>
        <Button
          size="sm"
          onClick={() => void runSweep()}
          disabled={running}
          className="ml-auto gap-1.5 bg-gradient-to-r from-nexus-violet to-nexus-blue text-xs font-semibold text-nexus-void hover:brightness-110"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          {running ? `Sweeping ${progress}%` : "Run sweep"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-nexus-red/30 bg-nexus-red/5 p-3 text-xs text-nexus-red">
          {error}
        </div>
      )}

      {points && points.length > 1 && (
        <SensitivityChart
          points={points}
          threshold={liveThreshold}
          baseline={baseline}
          valueLabel={featureLabel}
        />
      )}

      {baseline && (
        <p className="text-[11px] text-nexus-faint">
          Violet dot: nearest sweep point to the submitted value (
          <span className="font-mono text-nexus-dim">{baseline.value}</span>). Every
          point on the curve is a live model response.
        </p>
      )}

      <SourceNote>
        Single-input sensitivity is an <span className="text-nexus-dim">observation, not
        causation</span>: each point holds the other ten features fixed at the submitted
        values and queries the real model. Real-world changes usually move several
        features together.
      </SourceNote>
    </div>
  );
}

export function ExplainabilityView() {
  const focus = useViewStore((s) => s.explainFocus);
  const setExplainFocus = useViewStore((s) => s.setExplainFocus);
  const initialTab = focus ?? "global";

  // Consume the one-shot focus so later visits default to Global.
  useEffect(() => {
    if (focus !== null) setExplainFocus(null);
  }, [focus, setExplainFocus]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold text-nexus-text">
          <FlaskConical className="h-5 w-5 text-nexus-violet" aria-hidden />
          Explainability Lab
        </h1>
        <p className="max-w-2xl text-xs leading-relaxed text-nexus-faint">
          Explore why the model decides what it decides — every number below is
          computed from the actual serving artifacts, never invented.
        </p>
      </header>

      <Tabs defaultValue={initialTab}>
        <TabsList className="h-10 w-full justify-start gap-1 rounded-xl bg-nexus-panel p-1 sm:w-auto">
          <TabsTrigger value="global" className="gap-1.5 text-xs data-[state=active]:bg-nexus-raised">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Global importance
          </TabsTrigger>
          <TabsTrigger value="local" className="gap-1.5 text-xs data-[state=active]:bg-nexus-raised">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Local explanation
          </TabsTrigger>
          <TabsTrigger value="sensitivity" className="gap-1.5 text-xs data-[state=active]:bg-nexus-raised">
            <Waves className="h-3.5 w-3.5" aria-hidden />
            Sensitivity lab
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4 rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
          <GlobalImportancePanel />
        </TabsContent>
        <TabsContent value="local" className="mt-4 rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
          <LocalExplanationPanel />
        </TabsContent>
        <TabsContent value="sensitivity" className="mt-4 rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
          <SensitivityLabPanel />
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-2 text-[10px] text-nexus-faint">
        <RotateCcw className="h-3 w-3" aria-hidden />
        Re-run any panel at any time — results always reflect the live serving model.
        Current threshold shown on charts: {fmtPercent(0.7158444761787314, 2)} (live
        value is read from each response).
      </p>
    </div>
  );
}
