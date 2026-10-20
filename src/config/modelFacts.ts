/**
 * Verified facts about the model, sourced from the development notebook
 * (Credit_Card_Risk.ipynb) and the artifact provenance. These are labels and
 * fallbacks only — live values always come from the API. Nothing here is
 * estimated or invented.
 */
export const MODEL_FACTS = {
  name: "CREDITNEXUS AI",
  tagline: "Understand Risk. Explore Intelligence.",
  modelFamily: "XGBoost + sigmoid calibration",
  estimator: "CalibratedClassifierCV (5-fold sigmoid) over an XGBoost pipeline",
  featureCount: 11,
  datasetLabel: "32,581 loan records (public credit risk dataset, CC0)",
  threshold: 0.7158444761787314,
  thresholdLabel: "F1-optimized threshold on calibrated probabilities",
  classificationRule: "predicted_class = 1 if default_probability >= threshold else 0",
} as const;

/** Notebook-printed validation results (holdout, uncalibrated XGBoost). */
export const NOTEBOOK_METRICS = {
  source: "Development notebook outputs (uncalibrated XGBoost, holdout test set)",
  rows: [
    { label: "Accuracy", value: 0.92 },
    { label: "Precision", value: 0.82 },
    { label: "Recall", value: 0.79 },
    { label: "F1", value: 0.81 },
  ],
} as const;

/** Measured on the holdout set with the verified rebuilt artifact. */
export const MEASURED_METRICS = {
  source: "Measured at rebuild time on the holdout test set (n = 6,305)",
  rows: [
    { label: "Accuracy", value: 0.9383 },
    { label: "Precision", value: 0.9784 },
    { label: "Recall", value: 0.7305 },
    { label: "F1", value: 0.8365 },
    { label: "ROC AUC", value: 0.9486 },
    { label: "Avg precision", value: 0.9019 },
  ],
} as const;

export const PROVENANCE_STORY = [
  {
    title: "Original artifact audited",
    detail:
      "credit_risk_model.pkl was found to contain a 6,305-element probability array, not an estimator: notebook cell 81 reassigned the model variable before cell 82 dumped it.",
  },
  {
    title: "Intended pipeline reconstructed",
    detail:
      "The notebook's exact pipeline (cleaning, split, preprocessing, XGBoost, sigmoid calibration) was re-executed with identical seeds on the verified original dataset.",
  },
  {
    title: "Equivalence verified",
    detail:
      "The rebuild reproduces the uploaded artifact's probability array to within 2.6e-05 (Pearson r = 1.0) across all 6,305 test samples.",
  },
  {
    title: "Threshold preserved verbatim",
    detail:
      "best_threshold.pkl (0.7158) loaded and used unchanged — it is the notebook's F1-optimal threshold on the calibrated probability scale.",
  },
] as const;

export const DISCLOSURE =
  "Outputs are statistical estimates from a trained model — not guarantees of future behavior, and not lending decisions.";
