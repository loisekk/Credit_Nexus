/** Formatting helpers for probabilities, currency and latency. */

export function fmtProbability(p: number, digits = 4): string {
  if (!Number.isFinite(p)) return "—";
  return p.toFixed(digits);
}

export function fmtPercent(p: number, digits = 2): string {
  if (!Number.isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function fmtPercentOf(value: number, total: number, digits = 1): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return "—";
  return `${((value / total) * 100).toFixed(digits)}%`;
}

export function fmtCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return `${Math.round(ms)} ms`;
}

export function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtUptime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Neutral, non-judgmental wording for predicted classes. */
export function riskWording(prediction: 0 | 1): string {
  return prediction === 1
    ? "Higher predicted default risk"
    : "Lower predicted default risk";
}

export function riskTone(prediction: 0 | 1): "high" | "low" {
  return prediction === 1 ? "high" : "low";
}
