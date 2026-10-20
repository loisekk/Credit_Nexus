"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Eye, EyeOff, RotateCcw, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicantForm } from "@/features/analysis/ApplicantForm";
import { ResultsPanel } from "@/features/results/ResultsPanel";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useCharacterStore, CHARACTER_STATE_META } from "@/stores/useCharacterStore";
import { useAnalysisSubmission } from "@/hooks/useAnalysisSubmission";
import { cn } from "@/lib/utils";
import type { CreditRiskInput } from "@/types/api";

// Lazy-load the 3D scene for this view (kept out of the initial bundle path).
const AnalystScene = dynamic(
  () => import("@/components/three/AnalystScene").then((m) => m.AnalystScene),
  { ssr: false }
);

function SceneControls() {
  const visible = useCharacterStore((s) => s.visible);
  const toggleVisible = useCharacterStore((s) => s.toggleVisible);
  const resetCamera = useCharacterStore((s) => s.resetCamera);
  const reduced = useCharacterStore((s) => s.reducedMotion);
  const setReduced = useCharacterStore((s) => s.setReducedMotion);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={resetCamera}
        title="Reset camera"
        aria-label="Reset camera"
        className="rounded-lg border border-nexus-line bg-nexus-panel/70 p-1.5 text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={toggleVisible}
        title={visible ? "Hide NEXUS" : "Show NEXUS"}
        aria-label={visible ? "Hide NEXUS character" : "Show NEXUS character"}
        className="rounded-lg border border-nexus-line bg-nexus-panel/70 p-1.5 text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
      >
        {visible ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => setReduced(!reduced)}
        title={reduced ? "Disable low-performance view" : "Enable low-performance view"}
        aria-label="Toggle low-performance view"
        aria-pressed={reduced}
        className={cn(
          "rounded-lg border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60",
          reduced
            ? "border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber"
            : "border-nexus-line bg-nexus-panel/70 text-nexus-dim hover:border-nexus-line-strong hover:text-nexus-text"
        )}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function SceneStage() {
  const state = useCharacterStore((s) => s.state);
  const meta = CHARACTER_STATE_META[state];
  const tone =
    state === "highRisk"
      ? "text-nexus-amber"
      : state === "error"
        ? "text-nexus-red"
        : state === "lowRisk"
          ? "text-nexus-emerald"
          : state === "analyzing"
            ? "text-nexus-violet"
            : "text-nexus-cyan";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <AnalystScene mode="workspace" />
      </div>
      {/* status strip */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-nexus-line bg-nexus-panel/60 px-4 py-2.5 backdrop-blur">
        <p className="flex min-w-0 items-center gap-2 text-xs">
          <span className={cn("font-mono font-semibold", tone)}>{meta.label}</span>
          <span className="truncate text-[11px] text-nexus-faint">{meta.caption}</span>
        </p>
        <SceneControls />
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="shrink-0 border-b border-nexus-line px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-nexus-dim">
        {title}
      </h2>
      <p className="mt-0.5 text-[10px] text-nexus-faint">{subtitle}</p>
    </header>
  );
}

export function AnalysisView() {
  const status = useAnalysisStore((s) => s.status);
  const [mobileTab, setMobileTab] = useState("form");
  const { submit } = useAnalysisSubmission();

  const onAnalyze = useCallback(
    async (input: CreditRiskInput) => {
      await submit(input);
      // Surface the outcome on small screens once the live response lands.
      setMobileTab("results");
    },
    [submit]
  );

  const onRetry = useCallback(
    async (input: CreditRiskInput) => {
      await submit(input);
      setMobileTab("results");
    },
    [submit]
  );

  const busy = status === "analyzing";

  return (
    <div className="mx-auto h-[calc(100dvh-3.5rem)] w-full max-w-[1600px] px-0 sm:px-4 sm:py-4">
      {/* Mobile: tabbed panels */}
      <div className="block h-full lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex h-full flex-col">
          <div className="border-b border-nexus-line bg-nexus-void/80 px-4 pt-3 backdrop-blur">
            <TabsList className="h-9 w-full justify-start gap-1 rounded-lg bg-nexus-panel p-1">
              <TabsTrigger value="form" className="h-7 flex-1 text-xs data-[state=active]:bg-nexus-raised">
                1 · Applicant
              </TabsTrigger>
              <TabsTrigger value="nexus" className="h-7 flex-1 text-xs data-[state=active]:bg-nexus-raised">
                2 · NEXUS
              </TabsTrigger>
              <TabsTrigger value="results" className="h-7 flex-1 text-xs data-[state=active]:bg-nexus-raised">
                3 · Results
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="form" className="mt-0 min-h-0 flex-1 border-x border-nexus-line">
            <ApplicantForm onAnalyze={onAnalyze} disabled={busy} />
          </TabsContent>
          <TabsContent value="nexus" className="mt-0 min-h-0 flex-1">
            <SceneStage />
          </TabsContent>
          <TabsContent value="results" className="mt-0 min-h-0 flex-1 overflow-hidden border-x border-nexus-line">
            <ResultsPanel onRetry={onRetry} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: three-panel workspace */}
      <div className="hidden h-full grid-cols-[380px_minmax(0,1fr)_400px] gap-4 lg:grid">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-nexus-line bg-nexus-panel/40">
          <PanelHeader
            title="Applicant profile"
            subtitle="11 features · exact backend field mapping"
          />
          <ApplicantForm onAnalyze={onAnalyze} disabled={busy} />
        </section>

        <section className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-nexus-line bg-nexus-void">
          <SceneStage />
        </section>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-nexus-line bg-nexus-panel/40">
          <PanelHeader
            title="Risk intelligence"
            subtitle="live response from the calibrated model"
          />
          <ResultsPanel onRetry={onRetry} />
        </section>
      </div>
    </div>
  );
}
