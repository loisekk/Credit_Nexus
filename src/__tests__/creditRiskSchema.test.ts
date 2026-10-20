import { describe, expect, it } from "vitest";
import {
  creditRiskSchema,
  LOAN_GRADE_OPTIONS,
  SAMPLE_PROFILES,
} from "@/schemas/creditRisk";

const VALID = {
  person_age: 35,
  person_income: 72000,
  person_home_ownership: "MORTGAGE",
  person_emp_length: 8,
  loan_intent: "DEBTCONSOLIDATION",
  loan_grade: "B",
  loan_amnt: 12000,
  loan_int_rate: 10.9,
  loan_percent_income: 0.17,
  cb_person_default_on_file: "N",
  cb_person_cred_hist_length: 9,
};

describe("credit risk form schema", () => {
  it("accepts a valid profile and coerces numeric strings", () => {
    const result = creditRiskSchema.parse({
      ...VALID,
      person_age: "35",
      person_income: "72000",
    });
    expect(result.person_age).toBe(35);
    expect(result.person_income).toBe(72000);
    expect(result.loan_percent_income).toBeCloseTo(0.17);
  });

  it("rejects empty required fields", () => {
    const result = creditRiskSchema.safeParse({ ...VALID, person_age: "" });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-training-range numerics", () => {
    for (const [field, value] of [
      ["person_age", 130],
      ["person_income", 20000000],
      ["loan_int_rate", 40],
      ["loan_percent_income", 1.2],
      ["cb_person_cred_hist_length", 99],
    ] as const) {
      const result = creditRiskSchema.safeParse({ ...VALID, [field]: value });
      expect(result.success, `${field}=${value}`).toBe(false);
    }
  });

  it("enforces the notebook's logical constraint: employment ≤ age", () => {
    const result = creditRiskSchema.safeParse({ ...VALID, person_emp_length: 40 });
    expect(result.success).toBe(false);
  });

  it("rejects invented categorical values", () => {
    const result = creditRiskSchema.safeParse({ ...VALID, loan_grade: "Z" });
    expect(result.success).toBe(false);
    const result2 = creditRiskSchema.safeParse({
      ...VALID,
      person_home_ownership: "CASTLE",
    });
    expect(result2.success).toBe(false);
  });

  it("exposes exactly the grades the encoder learned", () => {
    expect([...LOAN_GRADE_OPTIONS]).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("ships sample profiles that all validate", () => {
    for (const sample of SAMPLE_PROFILES) {
      const result = creditRiskSchema.safeParse(sample.values);
      expect(result.success, sample.id).toBe(true);
    }
  });
});
