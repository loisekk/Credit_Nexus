/** Typed contracts for the credit-risk API (mirrors the FastAPI schemas). */

export interface CreditRiskInput {
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
}

export type RiskResultLabel = "High risk" | "Low risk";

export interface CreditRiskResult {
  default_probability: number;
  default_prediction: 0 | 1;
  threshold: number;
  Result: RiskResultLabel;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  ready: boolean;
  model_loaded: boolean;
  threshold_loaded: boolean;
  artifact_kind: string;
  load_error: string | null;
  uptime_seconds: number | null;
}

export interface FeatureSchemaEntry {
  name: string;
  label: string;
  description: string;
  type: "numeric" | "categorical";
  options?: string[];
  training_range?: { min: number; max: number };
}

export interface ProvenanceInfo {
  artifact_kind: string;
  rebuilt_at_utc: string;
  reason: string;
  intended_model: string;
  dataset: {
    source: string;
    file: string;
    sha256: string;
    rows: number;
    verification_checks_passed: string;
  };
  verification_vs_uploaded_array: {
    max_abs_diff: number;
    mean_abs_diff: number;
    pearson_correlation: number;
    same_side_of_0_5: number;
  };
  threshold: { value: number; source: string; re_derived_value: number };
  holdout_metrics_measured: HoldoutMetrics;
  notebook_reported_metrics: Record<string, Record<string, number> & { note?: string }>;
}

export interface HoldoutMetrics {
  evaluated_on: string;
  threshold_used: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  average_precision: number;
  brier_score: number;
  confusion_matrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
}

export interface ModelInfoResponse {
  ready: boolean;
  model: {
    class: string;
    task: string;
    target: string;
    positive_class: string;
    calibrated: boolean;
    calibration: { method: string; cv: number } | null;
    pipeline: {
      transformers: Array<{ name: string; columns: string[]; steps: string[] }>;
      classifier: string;
      classifier_params: Record<string, number | string | null>;
    };
    feature_names_in: string[];
    n_features: number;
  };
  threshold: { value: number; rule: string; source: string };
  feature_schema: FeatureSchemaEntry[];
  categorical_options: Record<string, string[]>;
  explainability: { shap: boolean; feature_importance: boolean; note: string };
  runtime: { python: string; scikit_learn: string; xgboost: string };
  limitations: string[];
  provenance?: ProvenanceInfo;
}

export interface FeatureImportanceEntry {
  feature: string;
  label: string;
  importance: number;
  share: number;
}

export interface FeatureImportanceResponse {
  available: boolean;
  method: string;
  importance_type: string;
  features: FeatureImportanceEntry[];
}

export interface ShapContribution {
  feature: string;
  label: string;
  contribution: number;
}

export interface ExplainResponse {
  prediction: CreditRiskResult;
  base_value: number;
  margin_sum: number;
  contributions: ShapContribution[];
  note: string;
}

/** Normalized client-side API error. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
