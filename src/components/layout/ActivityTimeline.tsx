"use client";

import {
  ArrowRightLeft,
  CircleAlert,
  CircleCheck,
  Cpu,
  Gauge,
  History,
  Radio,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useViewStore } from "@/stores/useViewStore";
import { useTimelineStore, type TimelineEventKind } from "@/stores/useTimelineStore";
import { fmtTime } from "@/utils/format";
import { cn } from "@/lib/utils";

const KIND_META: Record<TimelineEventKind, { icon: typeof History; color: string }> = {
  session: { icon: Sparkles, color: "text-nexus-cyan" },
  view: { icon: ArrowRightLeft, color: "text-nexus-blue" },
  submit: { icon: Gauge, color: "text-nexus-violet" },
  result: { icon: CircleCheck, color: "text-nexus-emerald" },
  error: { icon: CircleAlert, color: "text-nexus-red" },
  health: { icon: Radio, color: "text-nexus-amber" },
  system: { icon: Cpu, color: "text-nexus-dim" },
};

/** Session-scoped activity log — every entry reflects a real event. */
export function ActivityTimeline() {
  const open = useViewStore((s) => s.timelineOpen);
  const setOpen = useViewStore((s) => s.setTimelineOpen);
  const events = useTimelineStore((s) => s.events);
  const clear = useTimelineStore((s) => s.clear);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full border-nexus-line bg-nexus-deep sm:max-w-sm">
        <SheetHeader className="border-b border-nexus-line">
          <SheetTitle className="flex items-center gap-2 text-sm text-nexus-text">
            <History className="h-4 w-4 text-nexus-cyan" aria-hidden />
            Activity timeline
          </SheetTitle>
          <SheetDescription className="text-xs">
            Real events from this session only — nothing is stored or transmitted
            beyond the current page.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto nexus-scroll px-4 pb-6 pt-3">
          {events.length === 0 ? (
            <p className="mt-8 text-center text-xs text-nexus-faint">
              No activity yet. Submit an analysis to begin.
            </p>
          ) : (
            <ul className="space-y-1" role="log" aria-live="polite">
              {events.map((e) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.icon;
                return (
                  <li
                    key={e.id}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-nexus-panel"
                  >
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.color)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-nexus-text">
                        {e.title}
                      </p>
                      {e.detail && (
                        <p className="truncate text-[11px] text-nexus-faint" title={e.detail}>
                          {e.detail}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-nexus-faint">
                      {fmtTime(e.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {events.length > 0 && (
          <div className="border-t border-nexus-line p-3">
            <button
              type="button"
              onClick={clear}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-nexus-line px-3 py-2 text-xs text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear session log
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
