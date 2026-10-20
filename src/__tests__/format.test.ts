import { describe, expect, it } from "vitest";
import {
  fmtCurrency,
  fmtLatency,
  fmtNumber,
  fmtPercent,
  fmtProbability,
  fmtUptime,
  riskTone,
  riskWording,
} from "@/utils/format";

describe("probability formatting", () => {
  it("formats raw probabilities with fixed digits", () => {
    expect(fmtProbability(0.043462101407450215)).toBe("0.0435");
    expect(fmtProbability(0.9570012398898212, 4)).toBe("0.9570");
    expect(fmtProbability(NaN)).toBe("—");
  });

  it("formats percentages", () => {
    expect(fmtPercent(0.043462101407450215)).toBe("4.35%");
    expect(fmtPercent(0.7158444761787314, 1)).toBe("71.6%");
  });

  it("formats currency and numbers", () => {
    expect(fmtCurrency(55000)).toBe("$55,000");
    expect(fmtCurrency(1500000)).toBe("$1,500,000");
    expect(fmtNumber(32581)).toBe("32,581");
  });

  it("formats latency and uptime", () => {
    expect(fmtLatency(42.4)).toBe("42 ms");
    expect(fmtLatency(null)).toBe("—");
    expect(fmtUptime(3725)).toBe("1h 2m");
    expect(fmtUptime(125)).toBe("2m 5s");
    expect(fmtUptime(42)).toBe("42s");
  });
});

describe("risk wording", () => {
  it("uses neutral terminology per class", () => {
    expect(riskWording(1)).toBe("Higher predicted default risk");
    expect(riskWording(0)).toBe("Lower predicted default risk");
    expect(riskTone(1)).toBe("high");
    expect(riskTone(0)).toBe("low");
  });
});
