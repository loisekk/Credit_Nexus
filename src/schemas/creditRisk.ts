/**
 * Client-side form schema for the 11 applicant features.
 *
 * Numeric bounds are the model's TRAINING distribution (documented in the
 * development notebook): values outside them are extrapolations the model
 * never saw, so they are rejected with actionable messages rather than
 * silently passed. Categorical options mirror the categories learned by the
 * fitted OneHotEncoder (also served live by GET /model/info).
 */
import { z } from "zod";

export const HOME_OWNERSHIP_OPTIONS = ["MORTGAGE", "OTHER", "OWN", "RENT"] as const;
export const LOAN_INTENT_OPTIONS = [
  "DEBTCONSOLIDATION",
  "EDUCATION",
  "HOMEIMPROVEMENT",
  "MEDICAL",
  "PERSONAL",
  "VENTURE",
] as const;
export const LOAN_GRADE_OPTIONS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export const DEFAULT_ON_FILE_OPTIONS = ["N", "Y"] as const;

/** Training-distribution ranges (for UI hints + sensitivity sweeps). */
export const TRAINING_RANGES = {
  person_age: { min: 18, max: 100 },
  person_income: { min: 4000, max: 6000000 },
  person_emp_length: { min: 0, max: 60 },
  loan_amnt: { min: 500, max: 35000 },
  loan_int_rate: { min: 5.42, max: 23.22 },
  loan_percent_income: { min: 0, max: 0.83 },
  cb_person_cred_hist_length: { min: 2, max: 30 },
} as const;

export type NumericFeature = keyof typeof TRAINING_RANGES;

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const numberField = (range: { min: number; max: number }, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message: `${label} is required` })
      .min(range.min, `${label} must be at least ${range.min}`)
      .max(range.max, `${label} must be at most ${range.max}`)
  );

export const creditRiskSchema = z
  .object({
    person_age: numberField(TRAINING_RANGES.person_age, "Age"),
    person_income: numberField(TRAINING_RANGES.person_income, "Annual income"),
    person_home_ownership: z.enum(HOME_OWNERSHIP_OPTIONS, {
      message: "Select a home ownership status",
    }),
    person_emp_length: numberField(TRAINING_RANGES.person_emp_length, "Employment length"),
    loan_intent: z.enum(LOAN_INTENT_OPTIONS, { message: "Select a loan intent" }),
    loan_grade: z.enum(LOAN_GRADE_OPTIONS, { message: "Select a loan grade" }),
    loan_amnt: numberField(TRAINING_RANGES.loan_amnt, "Loan amount"),
    loan_int_rate: numberField(TRAINING_RANGES.loan_int_rate, "Interest rate"),
    loan_percent_income: numberField(
      TRAINING_RANGES.loan_percent_income,
      "Loan-to-income ratio"
    ),
    cb_person_default_on_file: z.enum(DEFAULT_ON_FILE_OPTIONS, {
      message: "Select the historical default status",
    }),
    cb_person_cred_hist_length: numberField(
      TRAINING_RANGES.cb_person_cred_hist_length,
      "Credit history length"
    ),
  })
  .superRefine((data, ctx) => {
    // Logical constraint enforced during notebook preprocessing:
    // employment length cannot exceed age.
    if (data.person_emp_length > data.person_age) {
      ctx.addIssue({
        code: "custom",
        path: ["person_emp_length"],
        message: "Employment length cannot exceed the applicant age",
      });
    }
  });

export type CreditRiskFormValues = z.input<typeof creditRiskSchema>;
export type CreditRiskParsedValues = z.output<typeof creditRiskSchema>;

/** Illustrative sample profiles — all values valid and in-distribution. */
export interface SampleProfile {
  id: string;
  name: string;
  description: string;
  values: {
    person_age: number;
    person_income: number;
    person_home_ownership: string;
    person_emp_length: number;
    loan_intent: string;
    loan_grade: string;
    loan_amnt: number;
    loan_int_rate: number;
    loan_percent_income: number;
    cb_person_default_on_file: string;
    cb_person_cred_hist_length: number;
  };
}

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: "balanced",
    name: "Balanced profile",
    description: "Mid-career applicant, moderate loan, grade B",
    values: {
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
    },
  },
  {
    id: "high-utilization",
    name: "High utilization",
    description: "Young renter, large loan share, past default",
    values: {
      person_age: 26,
      person_income: 32000,
      person_home_ownership: "RENT",
      person_emp_length: 3,
      loan_intent: "MEDICAL",
      loan_grade: "D",
      loan_amnt: 15000,
      loan_int_rate: 18.5,
      loan_percent_income: 0.47,
      cb_person_default_on_file: "Y",
      cb_person_cred_hist_length: 4,
    },
  },
  {
    id: "strong",
    name: "Strong profile",
    description: "Established owner, prime grade, long history",
    values: {
      person_age: 45,
      person_income: 150000,
      person_home_ownership: "OWN",
      person_emp_length: 20,
      loan_intent: "HOMEIMPROVEMENT",
      loan_grade: "A",
      loan_amnt: 8000,
      loan_int_rate: 7.2,
      loan_percent_income: 0.05,
      cb_person_default_on_file: "N",
      cb_person_cred_hist_length: 20,
    },
  },
];
