"use client";

import { useEffect } from "react";
import {
  ArrowRight,
  BrainCircuit,
  FlaskConical,
  Fingerprint,
  Gauge,
  MousePointer2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewStore } from "@/stores/useViewStore";
import { useCharacterStore, CHARACTER_STATE_META } from "@/stores/useCharacterStore";
import { useHealthStore } from "@/stores/useHealthStore";
import { useTimelineStore } from "@/stores/useTimelineStore";
import { MODEL_FACTS } from "@/config/modelFacts";
import { fmtPercent } from "@/utils/format";
import { cn } from "@/lib/utils";

const FACT_CHIPS = [
  { icon: BrainCircuit, label: MODEL_FACTS.modelFamily },
  { icon: Fingerprint, label: `${MODEL_FACTS.featureCount} applicant features` },
  { icon: Gauge, label: `threshold ${fmtPercent(MODEL_FACTS.threshold, 2)}` },
  { icon: ShieldCheck, label: "verified artifact provenance" },
];

export function WelcomeView({ sceneSlot }: { sceneSlot: React.ReactNode }) {
  const setView = useViewStore((s) => s.setView);
  const setState = useCharacterStore((s) => s.setState);
  const markGreeted = useCharacterStore((s) => s.markGreeted);
  const greetedAt = useCharacterStore((s) => s.greetedAt);
  const characterState = useCharacterStore((s) => s.state);
  const health = useHealthStore((s) => s.status);
  const pushEvent = useTimelineStore((s) => s.push);

  // Greet once per session on mount.
  useEffect(() => {
    pushEvent("session", "Session started", "CREDITNEXUS AI workstation initialized");
    if (!greetedAt) {
      setState("greeting");
      markGreeted();
    }
  }, [greetedAt, markGreeted, setState, pushEvent]);

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:py-10">
      {/* narrative column */}
      <div className="order-2 space-y-7 lg:order-1">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-nexus-cyan/25 bg-nexus-cyan/8 px-3 py-1 text-[11px] font-medium text-nexus-cyan">
            <Sparkles className="h-3 w-3" aria-hidden />
            Credit risk intelligence workstation
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-nexus-text sm:text-5xl">
            Understand Risk.
            <br />
            <span className="bg-gradient-to-r from-nexus-cyan via-nexus-blue to-nexus-violet bg-clip-text text-transparent">
              Explore Intelligence.
            </span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-nexus-dim">
            Meet <span className="font-medium text-nexus-text">NEXUS</span>, your
            virtual risk analyst. Submit an applicant profile and watch a
            calibrated XGBoost model score loan default probability in real
            time — with the threshold logic fully in view.
          </p>
        </div>

        {/* verified model facts */}
        <ul className="flex flex-wrap gap-2" aria-label="Verified model facts">
          {FACT_CHIPS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-lg border border-nexus-line bg-nexus-panel px-2.5 py-1.5 text-[11px] text-nexus-dim"
            >
              <Icon className="h-3 w-3 text-nexus-cyan/80" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={() => {
              setView("analysis");
              pushEvent("view", "Opened Analysis", "Start Risk Analysis action");
            }}
            className="h-11 gap-2 bg-gradient-to-r from-nexus-cyan to-nexus-blue px-6 text-sm font-semibold text-nexus-void hover:brightness-110"
          >
            Start Risk Analysis
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setView("explainability");
              pushEvent("view", "Opened Explainability", "Explore the Model action");
            }}
            className="h-11 gap-2 border-nexus-line-strong bg-nexus-panel/60 px-5 text-sm text-nexus-text hover:bg-nexus-raised"
          >
            <FlaskConical className="h-4 w-4 text-nexus-violet" aria-hidden />
            Explore the Model
          </Button>
        </div>

        {/* live status line */}
        <p className="flex items-center gap-2 text-[11px] text-nexus-faint">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              health === "online"
                ? "bg-nexus-emerald"
                : health === "offline"
                  ? "bg-nexus-red"
                  : health === "degraded"
                    ? "bg-nexus-amber"
                    : "animate-pulse bg-nexus-faint"
            )}
            aria-hidden
          />
          {health === "online"
            ? "Inference service online — predictions are live."
            : health === "offline"
              ? "Inference service unreachable — analysis will retry once the backend responds."
              : health === "degraded"
                ? "Inference service degraded — model artifact issue reported."
                : "Connecting to the inference service…"}
          <span className="mx-1 text-nexus-line-strong">·</span>
          <span className="font-mono">
            {CHARACTER_STATE_META[characterState].label}
          </span>
        </p>
      </div>

      {/* 3D chamber */}
      <div className="relative order-1 lg:order-2">
        <div className="nexus-glow-cyan relative h-[340px] overflow-hidden rounded-2xl border border-nexus-line sm:h-[420px] lg:h-[560px]">
          {sceneSlot}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-nexus-line bg-nexus-void/70 px-3 py-1 text-[10px] text-nexus-faint backdrop-blur">
              <MousePointer2 className="h-3 w-3" aria-hidden />
              drag to orbit · scroll to zoom
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
