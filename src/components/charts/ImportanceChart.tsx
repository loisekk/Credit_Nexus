"use client";

import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FeatureImportanceEntry } from "@/types/api";
import { fmtPercent } from "@/utils/format";

interface TooltipPayloadItem {
  payload: FeatureImportanceEntry;
}

function ImportanceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-nexus-line bg-nexus-deep/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-medium text-nexus-text">{item.label}</p>
      <p className="mt-0.5 font-mono text-nexus-cyan">
        share of total gain: {fmtPercent(item.share, 2)}
      </p>
    </div>
  );
}

/** Global feature importance (real gain values from the serving XGBoost). */
export const ImportanceChart = memo(function ImportanceChart({
  features,
}: {
  features: FeatureImportanceEntry[];
}) {
  const data = features.map((f) => ({ ...f, label: f.label }));
  return (
    <div className="h-[22rem] w-full" role="img" aria-label="Feature importance chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#94A3B814" />
          <XAxis
            type="number"
            domain={[0, (max: number) => max * 1.15]}
            tick={{ fill: "#5C6D87", fontSize: 10 }}
            axisLine={{ stroke: "#94A3B824" }}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: "#8FA0B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ImportanceTooltip />} cursor={{ fill: "#94A3B80F" }} />
          <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={14}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i < 3 ? "#22D3EE" : i < 6 ? "#38BDF8" : "#8B5CF6"}
                fillOpacity={Math.max(0.35, 1 - i * 0.06)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
