"use client";

import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SensitivityPoint {
  value: number;
  probability: number;
}

interface TooltipPayloadItem {
  payload: { value: number; probability: number };
}

function SensitivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload.probability;
  return (
    <div className="rounded-lg border border-nexus-line bg-nexus-deep/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-mono text-nexus-dim">{String(label)}</p>
      <p className="font-mono text-nexus-cyan">{(p * 100).toFixed(2)}% default risk</p>
    </div>
  );
}

/** Single-input sensitivity sweep — every point is a real model prediction. */
export const SensitivityChart = memo(function SensitivityChart({
  points,
  threshold,
  baseline,
  valueLabel,
}: {
  points: SensitivityPoint[];
  threshold: number;
  baseline: { value: number; probability: number } | null;
  valueLabel: string;
}) {
  return (
    <div className="h-[18rem] w-full" role="img" aria-label="Sensitivity chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: 4, right: 18, top: 8, bottom: 4 }}>
          <CartesianGrid stroke="#94A3B814" />
          <XAxis
            dataKey="value"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#5C6D87", fontSize: 10 }}
            axisLine={{ stroke: "#94A3B824" }}
            tickLine={false}
            label={{ value: valueLabel, position: "insideBottom", offset: -2, fill: "#5C6D87", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tick={{ fill: "#5C6D87", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            width={38}
          />
          <Tooltip content={<SensitivityTooltip />} cursor={{ stroke: "#22D3EE44" }} />
          <ReferenceLine
            y={threshold}
            stroke="#F5A623"
            strokeDasharray="6 4"
            label={{
              value: `threshold ${(threshold * 100).toFixed(1)}%`,
              fill: "#F5A623",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#22D3EE"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#22D3EE" }}
            activeDot={{ r: 4.5, fill: "#67E8F9" }}
            isAnimationActive={false}
          />
          {baseline && (
            <ReferenceDot
              x={baseline.value}
              y={baseline.probability}
              r={5}
              fill="#8B5CF6"
              stroke="#E6EDF7"
              strokeWidth={1.5}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
