"use client";

import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ActivityTimeline } from "@/components/layout/ActivityTimeline";
import { WelcomeView } from "@/features/welcome/WelcomeView";
import { AnalysisView } from "@/features/analysis/AnalysisView";
import { useViewStore, type ViewId } from "@/stores/useViewStore";
import { useHealthPolling } from "@/hooks/useHealthPolling";
import { useTimelineStore } from "@/stores/useTimelineStore";
import { DISCLOSURE } from "@/config/modelFacts";

// Secondary views are lazy-loaded to keep the first paint lean.
const ExplainabilityView = lazy(() =>
  import("@/features/explainability/ExplainabilityView").then((m) => ({
    default: m.ExplainabilityView,
  }))
);
const ObservatoryView = lazy(() =>
  import("@/features/observatory/ObservatoryView").then((m) => ({
    default: m.ObservatoryView,
  }))
);

// The 3D chamber — client-only, with internal WebGL/reduced-motion fallbacks.
const AnalystScene = dynamic(
  () => import("@/components/three/AnalystScene").then((m) => m.AnalystScene),
  { ssr: false }
);

const VIEW_TITLES: Record<ViewId, string> = {
  welcome: "Overview",
  analysis: "Risk Analysis Workspace",
  explainability: "Explainability Lab",
  observatory: "Model Observatory",
};

function ViewFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full border-2 border-nexus-cyan/30 border-t-nexus-cyan" />
    </div>
  );
}

export default function CreditNexusApp() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const pushEvent = useTimelineStore((s) => s.push);

  useHealthPolling();

  // Log view transitions (session-only activity timeline).
  useEffect(() => {
    if (view !== "welcome") {
      pushEvent("view", `Opened ${VIEW_TITLES[view]}`);
    }
  }, [view, pushEvent]);

  // Keyboard shortcuts: 1-4 jump between views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      const map: Record<string, ViewId> = {
        "1": "welcome",
        "2": "analysis",
        "3": "explainability",
        "4": "observatory",
      };
      const target = map[e.key];
      if (target && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setView(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  return (
    <div className="flex min-h-dvh flex-col bg-nexus-void">
      <TopBar />

      <main className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {view === "welcome" && (
              <WelcomeView
                sceneSlot={
                  <div className="h-full w-full">
                    <AnalystScene mode="hero" />
                  </div>
                }
              />
            )}
            {view === "analysis" && <AnalysisView />}
            {view === "explainability" && (
              <Suspense fallback={<ViewFallback />}>
                <ExplainabilityView />
              </Suspense>
            )}
            {view === "observatory" && (
              <Suspense fallback={<ViewFallback />}>
                <ObservatoryView />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="shrink-0 border-t border-nexus-line bg-nexus-void/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <p className="text-[10px] text-nexus-faint">{DISCLOSURE}</p>
          <p className="font-mono text-[10px] text-nexus-faint/70">
            CREDITNEXUS AI · threshold-gated calibrated XGBoost · 1.0.0
          </p>
        </div>
      </footer>

      <CommandPalette />
      <ActivityTimeline />
    </div>
  );
}
