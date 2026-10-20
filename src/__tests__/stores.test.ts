import { beforeEach, describe, expect, it } from "vitest";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useTimelineStore } from "@/stores/useTimelineStore";
import type { CreditRiskInput, CreditRiskResult } from "@/types/api";

const INPUT: CreditRiskInput = {
  person_age: 30, person_income: 55000, person_home_ownership: "RENT",
  person_emp_length: 4, loan_intent: "PERSONAL", loan_grade: "C",
  loan_amnt: 10000, loan_int_rate: 12.5, loan_percent_income: 0.18,
  cb_person_default_on_file: "N", cb_person_cred_hist_length: 4,
};

const RESULT: CreditRiskResult = {
  default_probability: 0.0434,
  default_prediction: 0,
  threshold: 0.7158,
  Result: "Low risk",
};

beforeEach(() => {
  useAnalysisStore.setState({
    status: "idle", seq: 0, input: null, result: null,
    error: null, errorCode: null, latencyMs: null, history: [],
  });
  useCharacterStore.setState({ state: "idle", greetedAt: null });
  useTimelineStore.setState({ events: [] });
});

describe("analysis store", () => {
  it("discards stale responses (older seq cannot overwrite newer)", () => {
    const { begin, succeed } = useAnalysisStore.getState();
    begin(INPUT); // seq 1
    const seq2 = begin(INPUT); // seq 2 supersedes
    succeed(RESULT, 20, 1); // stale — must be ignored
    expect(useAnalysisStore.getState().status).toBe("analyzing");
    succeed(RESULT, 25, seq2);
    expect(useAnalysisStore.getState().status).toBe("success");
    expect(useAnalysisStore.getState().result).toEqual(RESULT);
    expect(useAnalysisStore.getState().history).toHaveLength(1);
  });

  it("records failures with codes", () => {
    const { begin, fail } = useAnalysisStore.getState();
    const seq = begin(INPUT);
    fail("Cannot reach the inference service", "NETWORK_ERROR", seq);
    const s = useAnalysisStore.getState();
    expect(s.status).toBe("error");
    expect(s.errorCode).toBe("NETWORK_ERROR");
    expect(s.result).toBeNull();
  });

  it("caps history at 12 entries", () => {
    const { begin, succeed } = useAnalysisStore.getState();
    for (let i = 0; i < 15; i++) {
      const seq = begin(INPUT);
      succeed(RESULT, i, seq);
    }
    expect(useAnalysisStore.getState().history.length).toBeLessThanOrEqual(12);
  });
});

describe("character store (FSM)", () => {
  it("setSoftState never interrupts result or error states", () => {
    useCharacterStore.getState().setState("lowRisk");
    useCharacterStore.getState().setSoftState("listening");
    expect(useCharacterStore.getState().state).toBe("lowRisk");

    useCharacterStore.getState().setState("error");
    useCharacterStore.getState().setSoftState("idle");
    expect(useCharacterStore.getState().state).toBe("error");
  });

  it("setSoftState upgrades transient states", () => {
    useCharacterStore.getState().setState("idle");
    useCharacterStore.getState().setSoftState("listening");
    expect(useCharacterStore.getState().state).toBe("listening");
  });

  it("exposes a resettable camera signal and visibility", () => {
    useCharacterStore.getState().resetCamera();
    const s1 = useCharacterStore.getState().cameraResetSignal;
    useCharacterStore.getState().resetCamera();
    expect(useCharacterStore.getState().cameraResetSignal).toBeGreaterThan(s1);
    useCharacterStore.getState().toggleVisible();
    expect(useCharacterStore.getState().visible).toBe(false);
  });
});

describe("timeline store", () => {
  it("caps events at 60 and clears", () => {
    const { push, clear } = useTimelineStore.getState();
    for (let i = 0; i < 70; i++) push("system", `event ${i}`);
    expect(useTimelineStore.getState().events.length).toBeLessThanOrEqual(60);
    clear();
    expect(useTimelineStore.getState().events).toHaveLength(0);
  });
});
