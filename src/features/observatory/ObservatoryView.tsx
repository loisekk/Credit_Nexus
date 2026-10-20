"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Boxes,
  CircleAlert,
  Cpu,
  Database,
  FileSearch,
  Gauge,
  Layers,
  Loader2,
  Ruler,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { fetchModelInfo } from "@/services/api";
import { ApiError, type ModelInfoResponse } from "@/types/api";
import { emaLatency, useHealthStore } from "@/stores/useHealthStore";
import { MODEL_FACTS, MEASURED_METRICS, PROVENANCE_STORY } from "@/config/modelFacts";
import { fmtLatency, fmtPercent, fmtProbability, fmtUptime } from "@/utils/format";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "cyan",
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string;
  tone?: "cyan" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    cyan: "text-nexus-cyan",
    emerald: "text-nexus-emerald",
    amber: "text-nexus-amber",
    violet: "text-nexus-violet",
  };
  return (
    <div className="rounded-xl border border-nexus-line bg-nexus-panel/50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-nexus-faint">
        <Icon className={cn("h-3.5 w-3.5", tones[tone])} aria-hidden />
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold text-nexus-text" title={value}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-nexus-faint">{sub}</p>}
    </div>
  );
}

function LatencySparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) {
    return <p className="mt-2 text-[10px] text-nexus-faint">collecting…</p>;
  }
  const max = Math.max(...samples, 1);
  const points = samples
    .map((v, i) => `${(i / (samples.length - 1)) * 100},${28 - (v / max) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-2 h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="#22D3EE"
        strokeWidth={1.4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-nexus-dim">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-nexus-raised">
          <div
            className="h-full rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-violet"
            style={{ width: `${Math.round(value * 100)}%` }}
          />
        </div>
        <span className="w-10 text-right font-mono text-[11px] text-nexus-text">
          {value.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

export function ObservatoryView() {
  const [info, setInfo] = useState<ModelInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const health = useHealthStore();
  const latency = emaLatency(health.latencies);
  const predictLatencies = useMemo(
    () => health.latencies.filter((l) => l.endpoint === "/predict").map((l) => l.ms).reverse(),
    [health.latencies]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchModelInfo(controller.signal)
      .then(setInfo)
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Failed to load model info");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const threshold = info?.threshold.value ?? MODEL_FACTS.threshold;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold text-nexus-text">
          <Cpu className="h-5 w-5 text-nexus-cyan" aria-hidden />
          Model Observatory
        </h1>
        <p className="max-w-2xl text-xs leading-relaxed text-nexus-faint">
          Live runtime information and verified metadata for the serving model.
          Only measured values and documented facts appear here.
        </p>
      </header>

      {loading && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-nexus-faint">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Reading model metadata from the service…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2.5 rounded-xl border border-nexus-red/30 bg-nexus-red/5 p-4 text-xs leading-relaxed text-nexus-red">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {error} — the observatory requires a live backend connection. Verify
            the inference service and reload.
          </span>
        </div>
      )}

      {!loading && info && (
        <div className="space-y-5">
          {/* status row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={BadgeCheck}
              label="Service"
              value={health.ready ? "Ready" : health.status}
              sub={health.loadError ? "artifact issue reported" : `uptime ${fmtUptime(health.uptimeSeconds)}`}
              tone={health.ready ? "emerald" : "amber"}
            />
            <StatCard
              icon={Boxes}
              label="Estimator"
              value={info.model.class}
              sub={`calibrated · ${info.model.calibration?.method ?? "n/a"} ×${info.model.calibration?.cv ?? "?"} folds`}
              tone="cyan"
            />
            <StatCard
              icon={Ruler}
              label="Threshold"
              value={fmtProbability(threshold)}
              sub="F1-optimal, calibrated scale"
              tone="amber"
            />
            <StatCard
              icon={Timer}
              label="API latency (EMA)"
              value={fmtLatency(latency)}
              sub={`${predictLatencies.length} predict samples this session`}
              tone="violet"
            />
          </div>

          {/* latency sparkline */}
          <section className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-nexus-faint">
              <Activity className="h-3.5 w-3.5 text-nexus-cyan" aria-hidden />
              Measured request latency (this session, client-side)
            </p>
            <LatencySparkline samples={predictLatencies} />
            <p className="mt-1 text-[10px] text-nexus-faint">
              Every point is a real timed request from this page — no synthetic
              telemetry.
            </p>
          </section>

          {/* pipeline */}
          <section className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-text">
              <Layers className="h-4 w-4 text-nexus-violet" aria-hidden />
              Inference pipeline
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                "11 raw features",
                "median impute · 7 numeric",
                "one-hot encode · 4 categorical",
                `${info.model.pipeline.classifier} (${info.model.pipeline.classifier_params.n_estimators ?? "?"} trees)`,
                `sigmoid calibration ×${info.model.calibration?.cv ?? 5}`,
                `threshold ${fmtPercent(threshold, 2)}`,
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-nexus-line bg-nexus-deep px-2.5 py-1.5 font-mono text-[10px] text-nexus-dim">
                    {step}
                  </span>
                  {i < arr.length - 1 && <span className="text-nexus-faint">→</span>}
                </span>
              ))}
            </div>
          </section>

          {/* schema */}
          <section className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-text">
              <Database className="h-4 w-4 text-nexus-cyan" aria-hidden />
              Feature schema ({info.feature_schema.length})
            </h2>
            <div className="mt-3 overflow-x-auto nexus-scroll">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-nexus-line text-[10px] uppercase tracking-wide text-nexus-faint">
                    <th className="py-2 pr-4 font-medium">Field</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Valid values / training range</th>
                  </tr>
                </thead>
                <tbody>
                  {info.feature_schema.map((f) => (
                    <tr key={f.name} className="border-b border-nexus-line/50">
                      <td className="py-2 pr-4">
                        <span className="font-mono text-[11px] text-nexus-text">{f.name}</span>
                        <span className="block text-[10px] text-nexus-faint">{f.label}</span>
                      </td>
                      <td className="py-2 pr-4 text-nexus-dim">{f.type}</td>
                      <td className="py-2 font-mono text-[10px] text-nexus-dim">
                        {f.options
                          ? f.options.join(" · ")
                          : f.training_range
                            ? `${f.training_range.min} – ${f.training_range.max}`
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-nexus-faint">
              Categorical options are read live from the encoder fitted during
              training — not hardcoded.
            </p>
          </section>

          {/* metrics — measured vs notebook-reported */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-text">
                <Gauge className="h-4 w-4 text-nexus-emerald" aria-hidden />
                Measured holdout performance
              </h2>
              <p className="mt-1 text-[10px] text-nexus-faint">{MEASURED_METRICS.source}</p>
              <div className="mt-3">
                {(Object.entries(
                  info.provenance?.holdout_metrics_measured ?? {}
                ) as Array<[string, number | string | object]>)
                  .filter(([k]) =>
                    ["accuracy", "precision", "recall", "f1", "roc_auc", "average_precision", "brier_score"].includes(k)
                  )
                  .map(([k, v]) => (
                    <MetricRow key={k} label={k.replace(/_/g, " ")} value={Number(v)} />
                  ))}
              </div>
              {info.provenance?.holdout_metrics_measured && (
                <p className="mt-2 font-mono text-[10px] text-nexus-faint">
                  confusion: TN {info.provenance.holdout_metrics_measured.confusion_matrix.true_negative} ·
                  FP {info.provenance.holdout_metrics_measured.confusion_matrix.false_positive} ·
                  FN {info.provenance.holdout_metrics_measured.confusion_matrix.false_negative} ·
                  TP {info.provenance.holdout_metrics_measured.confusion_matrix.true_positive}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-text">
                <FileSearch className="h-4 w-4 text-nexus-amber" aria-hidden />
                Notebook-reported metrics
              </h2>
              <p className="mt-1 text-[10px] text-nexus-faint">
                Development notebook outputs (uncalibrated XGBoost, holdout set) —
                reported for reference, distinct from the measured values.
              </p>
              <div className="mt-3">
                <MetricRow label="accuracy" value={0.92} />
                <MetricRow label="precision" value={0.82} />
                <MetricRow label="recall" value={0.79} />
                <MetricRow label="f1" value={0.81} />
                <MetricRow label="roc-auc (5-fold cv)" value={0.9465} />
              </div>
            </div>
          </section>

          {/* provenance */}
          <section className="rounded-2xl border border-nexus-line bg-nexus-panel/30 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-text">
              <ShieldAlert className="h-4 w-4 text-nexus-cyan" aria-hidden />
              Artifact provenance &amp; verification
            </h2>
            <ol className="mt-3 space-y-3">
              {PROVENANCE_STORY.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-nexus-cyan/40 bg-nexus-cyan/10 font-mono text-[10px] text-nexus-cyan">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-nexus-text">{step.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-nexus-faint">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {info.provenance && (
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-nexus-line bg-nexus-deep p-3 sm:grid-cols-4">
                {[
                  { label: "max abs diff", value: info.provenance.verification_vs_uploaded_array.max_abs_diff.toExponential(2) },
                  { label: "pearson r", value: info.provenance.verification_vs_uploaded_array.pearson_correlation.toFixed(8) },
                  { label: "same-side", value: `${(info.provenance.verification_vs_uploaded_array.same_side_of_0_5 * 100).toFixed(1)}%` },
                  { label: "dataset checks", value: info.provenance.dataset.verification_checks_passed },
                ].map((v) => (
                  <div key={v.label}>
                    <p className="text-[9px] uppercase tracking-wide text-nexus-faint">{v.label}</p>
                    <p className="font-mono text-xs text-nexus-cyan">{v.value}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-nexus-faint">
              Runtime: python {info.runtime.python} · scikit-learn {info.runtime.scikit_learn} ·
              xgboost {info.runtime.xgboost}. Replace the artifact file to serve your
              own re-exported estimator — see the README.
            </p>
          </section>

          {/* limitations */}
          <section className="rounded-2xl border border-nexus-amber/25 bg-nexus-amber/5 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-nexus-amber">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              Model limitations
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {info.limitations.map((l) => (
                <li key={l} className="flex items-start gap-2 text-[11px] leading-relaxed text-nexus-dim">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-nexus-amber/70" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
