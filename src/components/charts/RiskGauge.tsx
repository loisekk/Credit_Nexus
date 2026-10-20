"use client";

import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { fmtPercent } from "@/utils/format";

/**
 * Radial risk gauge with an explicit classification-threshold marker.
 * The needle settles on the exact API probability; the threshold tick is
 * drawn at the API threshold. Zones are informational — the decision rule
 * shown in text is always `probability >= threshold`.
 */
export function RiskGauge({
  probability,
  threshold,
  prediction,
}: {
  probability: number;
  threshold: number;
  prediction: 0 | 1;
}) {
  const reducedMotion = useCharacterStore((s) => s.reducedMotion);
  const animated = useAnimatedNumber(probability, {
    durationMs: 1300,
    reducedMotion,
  });

  const R = 80;
  const CX = 100;
  const CY = 100;
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - from);
    const a2 = Math.PI * (1 - to);
    const x1 = CX + R * Math.cos(a1);
    const y1 = CY - R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2);
    const y2 = CY - R * Math.sin(a2);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const p = Math.min(1, Math.max(0, animated));
  const tone = prediction === 1 ? "#F87171" : "#34D399";
  const strongTone = prediction === 1 ? "#F5A623" : "#22D3EE";

  // needle geometry
  const angle = Math.PI * (1 - p);
  const nx = CX + (R - 14) * Math.cos(angle);
  const ny = CY - (R - 14) * Math.sin(angle);
  // threshold tick geometry
  const tAngle = Math.PI * (1 - threshold);
  const tx1 = CX + (R - 10) * Math.cos(tAngle);
  const ty1 = CY - (R - 10) * Math.sin(tAngle);
  const tx2 = CX + (R + 10) * Math.cos(tAngle);
  const ty2 = CY - (R + 10) * Math.sin(tAngle);

  return (
    <figure className="select-none" aria-label="Default probability gauge">
      <svg viewBox="0 0 200 118" className="w-full" role="img">
        <defs>
          <linearGradient id="gauge-active" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={strongTone} />
            <stop offset="100%" stopColor={tone} />
          </linearGradient>
        </defs>
        {/* base track */}
        <path d={arc(0, 1)} fill="none" stroke="#182236" strokeWidth={13} strokeLinecap="round" />
        {/* threshold zone hint (subtle hatch between threshold and 1) */}
        <path
          d={arc(threshold, 1)}
          fill="none"
          stroke="#F5A62326"
          strokeWidth={13}
          strokeLinecap="butt"
        />
        {/* active arc */}
        <path
          d={arc(0, p)}
          fill="none"
          stroke="url(#gauge-active)"
          strokeWidth={13}
          strokeLinecap="round"
          pathLength={100}
          style={{ strokeDasharray: 100, strokeDashoffset: 0 }}
        />
        {/* threshold tick */}
        <line
          x1={tx1}
          y1={ty1}
          x2={tx2}
          y2={ty2}
          stroke="#F5A623"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        {/* needle */}
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="#E6EDF7"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.9}
        />
        <circle cx={CX} cy={CY} r={4.5} fill="#0C1322" stroke="#E6EDF7" strokeWidth={1.6} />
        {/* scale labels */}
        <text x={CX - R - 4} y={CY + 13} textAnchor="middle" fontSize="9" fill="#5C6D87">
          0%
        </text>
        <text x={CX + R + 4} y={CY + 13} textAnchor="middle" fontSize="9" fill="#5C6D87">
          100%
        </text>
        <text
          x={CX + (R + 20) * Math.cos(tAngle)}
          y={CY - (R + 20) * Math.sin(tAngle) + 3}
          textAnchor="middle"
          fontSize="8.5"
          fill="#F5A623"
        >
          {fmtPercent(threshold, 1)}
        </text>
      </svg>
      <figcaption className="-mt-6 text-center">
        <span
          className="font-mono text-4xl font-semibold tracking-tight"
          style={{ color: tone }}
        >
          {fmtPercent(animated, 2)}
        </span>
        <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-nexus-faint">
          predicted default probability
        </span>
      </figcaption>
    </figure>
  );
}
