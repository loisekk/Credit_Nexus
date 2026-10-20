"use client";

import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useViewStore, VIEW_META, type ViewId } from "@/stores/useViewStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useTimelineStore } from "@/stores/useTimelineStore";
import { emaLatency, useHealthStore } from "@/stores/useHealthStore";
import { fmtLatency } from "@/utils/format";
import { MODEL_FACTS } from "@/config/modelFacts";

const NAV_ITEMS: ViewId[] = ["welcome", "analysis", "explainability", "observatory"];

export function CommandPalette() {
  const open = useViewStore((s) => s.paletteOpen);
  const setPaletteOpen = useViewStore((s) => s.setPaletteOpen);
  const setView = useViewStore((s) => s.setView);
  const toggleVisible = useCharacterStore((s) => s.toggleVisible);
  const resetCamera = useCharacterStore((s) => s.resetCamera);
  const setReducedMotion = useCharacterStore((s) => s.setReducedMotion);
  const reducedMotion = useCharacterStore((s) => s.reducedMotion);
  const resetAnalysis = useAnalysisStore((s) => s.reset);
  const toggleTimeline = useViewStore((s) => s.toggleTimeline);
  const pushEvent = useTimelineStore((s) => s.push);
  const status = useHealthStore((s) => s.status);
  const latencies = useHealthStore((s) => s.latencies);
  const latency = emaLatency(latencies);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useViewStore.getState().togglePalette();
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  const go = (view: ViewId) => {
    setView(view);
    pushEvent("view", `Opened ${VIEW_META[view].label}`, VIEW_META[view].hint);
    setPaletteOpen(false);
  };

  const act = (label: string, fn: () => void) => {
    fn();
    pushEvent("system", label);
    setPaletteOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList className="nexus-scroll">
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((id, i) => (
            <CommandItem key={id} onSelect={() => go(id)}>
              <span>{VIEW_META[id].label}</span>
              <span className="ml-2 text-xs text-nexus-faint">
                {VIEW_META[id].hint}
              </span>
              <CommandShortcut>{i + 1}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => act("Reset analysis", resetAnalysis)}>
            Reset current analysis
          </CommandItem>
          <CommandItem
            onSelect={() => act("Toggled NEXUS visibility", toggleVisible)}
          >
            Toggle NEXUS character
          </CommandItem>
          <CommandItem onSelect={() => act("Camera reset", resetCamera)}>
            Reset scene camera
          </CommandItem>
          <CommandItem
            onSelect={() =>
              act(
                reducedMotion ? "Low-performance view off" : "Low-performance view on",
                () => setReducedMotion(!reducedMotion)
              )
            }
          >
            {reducedMotion ? "Disable" : "Enable"} low-performance view
          </CommandItem>
          <CommandItem onSelect={() => act("Opened activity", toggleTimeline)}>
            Open activity timeline
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Status">
          <CommandItem disabled>
            Backend: {status}
            {latency !== null ? ` · ${fmtLatency(latency)}` : ""}
          </CommandItem>
          <CommandItem disabled>
            Threshold: {MODEL_FACTS.threshold.toFixed(4)}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
