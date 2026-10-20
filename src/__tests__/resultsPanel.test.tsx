import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPanel } from "@/features/results/ResultsPanel";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import type { CreditRiskInput, CreditRiskResult } from "@/types/api";

const INPUT: CreditRiskInput = {
  person_age: 30, person_income: 55000, person_home_ownership: "RENT",
  person_emp_length: 4, loan_intent: "PERSONAL", loan_grade: "C",
  loan_amnt: 10000, loan_int_rate: 12.5, loan_percent_income: 0.18,
  cb_person_default_on_file: "N", cb_person_cred_hist_length: 4,
};

function setStore(partial: Parameters<typeof useAnalysisStore.setState>[0]) {
  useAnalysisStore.setState(partial);
}

describe("ResultsPanel rendering", () => {
  it("shows the empty state before any analysis", () => {
    setStore({ status: "idle", result: null, error: null, input: null });
    render(<ResultsPanel onRetry={vi.fn()} />);
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });

  it("shows the analyzing state while awaiting the live response", () => {
    setStore({ status: "analyzing", input: INPUT, result: null, error: null });
    render(<ResultsPanel onRetry={vi.fn()} />);
    expect(screen.getByText(/NEXUS is analyzing/i)).toBeInTheDocument();
  });

  it("renders the exact API numbers for a low-risk result", () => {
    const result: CreditRiskResult = {
      default_probability: 0.043462101407450215,
      default_prediction: 0,
      threshold: 0.7158444761787314,
      Result: "Low risk",
    };
    setStore({ status: "success", result, input: INPUT, latencyMs: 42 });
    render(<ResultsPanel onRetry={vi.fn()} />);
    expect(screen.getByText("Lower predicted default risk")).toBeInTheDocument();
    expect(screen.getByText("Low risk")).toBeInTheDocument();
    // threshold comparison rendered with the actual values
    expect(screen.getByText(/0\.0435/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.7158/i)).toBeInTheDocument();
    expect(screen.getAllByText(/4\.35%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/71\.58%/).length).toBeGreaterThan(0);
    // gauge accessible label carries both values
    expect(screen.getByRole("img", { name: /probability 4\.35% versus threshold 71\.58%/i })).toBeInTheDocument();
  });

  it("renders high-risk wording for a positive default prediction", () => {
    const result: CreditRiskResult = {
      default_probability: 0.9570012398898212,
      default_prediction: 1,
      threshold: 0.7158444761787314,
      Result: "High risk",
    };
    setStore({ status: "success", result, input: INPUT, latencyMs: 42 });
    render(<ResultsPanel onRetry={vi.fn()} />);
    expect(screen.getByText("Higher predicted default risk")).toBeInTheDocument();
    // the "not a correctness probability" clarification is rendered
    expect(screen.getByText(/classification is correct/i)).toBeInTheDocument();
  });

  it("shows an actionable error with retry that re-sends the same input", async () => {
    const onRetry = vi.fn();
    setStore({
      status: "error",
      error: "Cannot reach the inference service (/predict).",
      errorCode: "NETWORK_ERROR",
      input: INPUT,
      result: null,
    });
    render(<ResultsPanel onRetry={onRetry} />);
    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot reach the inference service/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry request/i }));
    expect(onRetry).toHaveBeenCalledWith(INPUT);
  });
});
