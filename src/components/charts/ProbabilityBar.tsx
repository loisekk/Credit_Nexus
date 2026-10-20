"use client";

import { fmtPercent } from "@/utils/format";

/**
 * Probability distribution bar with an explicit threshold marker,
 * labelled with the actual API values.
 */
export function ProbabilityBar({
  probability,
  threshold,
}: {
  probability: number;
  threshold: number;
}) {
  const pPct = Math.min(100, Math.max(0, probability * 100));
  const tPct = Math.min(100, Math.max(0, threshold * 100));
  const above = probability >= threshold;

  return (
    <div role="img" aria-label={`Probability ${fmtPercent(probability)} versus threshold ${fmtPercent(threshold)}`}>
      <div className="relative h-7 w-full overflow-visible rounded-full border border-nexus-line bg-nexus-raised">
        {/* fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pPct}%`,
            background: above
              ? "linear-gradient(90deg, #8B5CF6AA, #F5A623CC, #F87171E6)"
              : "linear-gradient(90deg, #22D3EE99, #34D399CC)",
          }}
        />
        {/* threshold marker */}
        <div
          className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-nexus-amber"
          style={{ left: `${tPct}%` }}
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-nexus-amber/40 bg-nexus-deep px-1.5 py-0.5 font-mono text-[9px] text-nexus-amber">
            {fmtPercent(threshold, 1)}
          </span>
        </div>
        {/* value label riding the fill edge */}
        <span
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-nexus-line-strong bg-nexus-deep px-1.5 py-0.5 font-mono text-[10px] text-nexus-text"
          style={{
            left: `min(calc(${pPct}% - ${above ? 52 : -6}px), calc(100% - 58px))`,
          }}
        >
          {fmtPercent(probability, 2)}
        </span>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-nexus-faint">
        <span>0%</span>
        <span className="text-nexus-amber/90">▲ classification threshold</span>
        <span>100%</span>
      </div>
    </div>
  );
}
