"use client";

import {
  Activity,
  Command,
  Cpu,
  Gauge,
  Hexagon,
  Microscope,
  ShieldCheck,
} from "lucide-react";
import { emaLatency, useHealthStore, type BackendStatus } from "@/stores/useHealthStore";
import { useViewStore, VIEW_META, type ViewId } from "@/stores/useViewStore";
import { fmtLatency } from "@/utils/format";
import { cn } from "@/lib/utils";

const NAV: Array<{ id: ViewId; icon: typeof Gauge }> = [
  { id: "welcome", icon: Hexagon },
  { id: "analysis", icon: Gauge },
  { id: "explainability", icon: Microscope },
  { id: "observatory", icon: Cpu },
];

const STATUS_STYLES: Record<BackendStatus, { dot: string; label: string; text: string }> = {
  checking: { dot: "bg-nexus-faint animate-pulse", label: "Connecting", text: "text-nexus-faint" },
  online: { dot: "bg-nexus-emerald", label: "Model online", text: "text-nexus-emerald" },
  degraded: { dot: "bg-nexus-amber", label: "Degraded", text: "text-nexus-amber" },
  offline: { dot: "bg-nexus-red", label: "Offline", text: "text-nexus-red" },
};

export function TopBar() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const togglePalette = useViewStore((s) => s.togglePalette);
  const toggleTimeline = useViewStore((s) => s.toggleTimeline);
  const status = useHealthStore((s) => s.status);
  const latencies = useHealthStore((s) => s.latencies);
  const latency = emaLatency(latencies);
  const s = STATUS_STYLES[status];

  return (
    <header className="sticky top-0 z-40 border-b border-nexus-line bg-nexus-void/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* brand */}
        <button
          type="button"
          onClick={() => setView("welcome")}
          className="group flex items-center gap-2.5 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
          aria-label="CREDITNEXUS AI home"
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 rotate-45 rounded-[26%] border border-nexus-cyan/50 transition-transform duration-500 group-hover:rotate-[70deg]" />
            <span className="absolute inset-[5px] rotate-45 rounded-[26%] bg-gradient-to-br from-nexus-cyan/25 to-nexus-violet/25" />
            <span className="relative font-mono text-sm font-bold text-nexus-cyan">N</span>
          </span>
          <span className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-[13px] font-semibold tracking-[0.18em] text-nexus-text">
              CREDITNEXUS
            </span>
            <span className="text-[10px] tracking-[0.22em] text-nexus-faint">
              RISK INTELLIGENCE
            </span>
          </span>
        </button>

        {/* nav */}
        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          {NAV.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              title={VIEW_META[id].hint}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60",
                view === id
                  ? "bg-nexus-raised text-nexus-cyan"
                  : "text-nexus-dim hover:bg-nexus-panel hover:text-nexus-text"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden md:inline">{VIEW_META[id].label}</span>
            </button>
          ))}
        </nav>

        <div className="mx-1 hidden h-5 w-px bg-nexus-line sm:block" />

        {/* health pill */}
        <div
          className="hidden items-center gap-2 rounded-full border border-nexus-line bg-nexus-panel px-3 py-1.5 sm:flex"
          title="Backend connection status and measured latency"
        >
          <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
          <span className={cn("text-[11px] font-medium", s.text)}>{s.label}</span>
          {latency !== null && (
            <span className="border-l border-nexus-line pl-2 font-mono text-[10px] text-nexus-faint">
              {fmtLatency(latency)}
            </span>
          )}
        </div>

        {/* actions */}
        <button
          type="button"
          onClick={togglePalette}
          className="flex items-center gap-2 rounded-lg border border-nexus-line bg-nexus-panel px-2.5 py-1.5 text-[11px] text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
          aria-label="Open command palette"
        >
          <Command className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden font-mono text-[10px] lg:inline">Ctrl K</span>
        </button>
        <button
          type="button"
          onClick={toggleTimeline}
          className="relative rounded-lg border border-nexus-line bg-nexus-panel p-1.5 text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
          aria-label="Toggle activity timeline"
          title="Session activity timeline"
        >
          <Activity className="h-4 w-4" aria-hidden />
        </button>
        <span
          className="hidden items-center gap-1.5 rounded-lg border border-nexus-line bg-nexus-panel px-2.5 py-1.5 text-[10px] text-nexus-faint xl:flex"
          title="Responsible AI: model estimates, not lending decisions"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-nexus-emerald/80" aria-hidden />
          Model estimate — not a lending decision
        </span>
      </div>
    </header>
  );
}
