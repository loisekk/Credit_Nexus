"""Audit script: inspect the serialized model and threshold artifacts (read-only)."""
import joblib
import numpy as np

MODEL_PATH = "/home/z/my-project/upload/credit_risk_model.pkl"
THRESH_PATH = "/home/z/my-project/upload/best_threshold.pkl"


def describe(obj, depth=0, max_depth=4):
    pad = "  " * depth
    lines = []
    cls = type(obj).__name__
    module = type(obj).__module__
    lines.append(f"{pad}- {cls} (module={module})")
    if depth >= max_depth:
        return lines
    # Pipeline
    if hasattr(obj, "steps") and hasattr(obj, "named_steps"):
        lines.append(f"{pad}  steps:")
        for name, step in obj.steps:
            lines.append(f"{pad}    * {name}: {type(step).__name__}")
            lines.extend(describe(step, depth + 3, max_depth))
    # ColumnTransformer
    if hasattr(obj, "transformers_"):
        lines.append(f"{pad}  transformers_:")
        for t in obj.transformers_:
            lines.append(f"{pad}    * name={t[0]} cols={t[2]} -> {type(t[1]).__name__}")
            if hasattr(t[1], "categories_"):
                for c, cats in zip(t[2], t[1].categories_):
                    lines.append(f"{pad}      categories[{c}] = {list(cats)}")
            if hasattr(t[1], "feature_names_in_"):
                lines.append(f"{pad}      feature_names_in_ = {list(t[1].feature_names_in_)}")
            if hasattr(t[1], "statistics_"):
                lines.append(f"{pad}      imputer statistics_ = {list(t[1].statistics_)}")
    # OneHotEncoder directly
    if hasattr(obj, "categories_"):
        lines.append(f"{pad}  categories_ = {[list(c) for c in obj.categories_]}")
    # Feature names
    if hasattr(obj, "feature_names_in_"):
        lines.append(f"{pad}  feature_names_in_ = {list(obj.feature_names_in_)}")
    if hasattr(obj, "n_features_in_"):
        lines.append(f"{pad}  n_features_in_ = {obj.n_features_in_}")
    # Tree ensembles
    if hasattr(obj, "feature_importances_"):
        lines.append(f"{pad}  feature_importances_ = {np.round(obj.feature_importances_, 5).tolist()}")
    if hasattr(obj, "n_estimators"):
        lines.append(f"{pad}  n_estimators = {obj.n_estimators}")
    if hasattr(obj, "classes_"):
        lines.append(f"{pad}  classes_ = {list(obj.classes_)}")
    # Linear models
    if hasattr(obj, "coef_"):
        lines.append(f"{pad}  coef_ = {np.round(np.ravel(obj.coef_), 5).tolist()}")
    if hasattr(obj, "intercept_"):
        lines.append(f"{pad}  intercept_ = {np.ravel(obj.intercept_).tolist()}")
    # XGBoost / LightGBM / CatBoost detection
    for lib in ("xgboost", "lightgbm", "catboost"):
        if module.startswith(lib):
            lines.append(f"{pad}  [external library: {lib}]")
    # Key hyperparams of estimators
    if hasattr(obj, "get_params"):
        try:
            params = obj.get_params(deep=False)
            keep = {k: v for k, v in params.items()
                    if isinstance(v, (int, float, str, bool, type(None)))}
            lines.append(f"{pad}  params(shallow) = {keep}")
        except Exception as e:
            lines.append(f"{pad}  params error: {e}")
    return lines


report = []
report.append("### MODEL ARTIFACT ###")
model = joblib.load(MODEL_PATH)
report.extend(describe(model))

report.append("\n### THRESHOLD ARTIFACT ###")
threshold = joblib.load(THRESH_PATH)
report.append(f"type={type(threshold)} repr={threshold!r}")
if isinstance(threshold, (int, float, np.floating, np.integer)):
    report.append(f"valid range check: 0 <= {float(threshold)} <= 1 -> {0.0 <= float(threshold) <= 1.0}")

report.append("\n### PIPELINE feature names out ###")
try:
    report.append(f"get_feature_names_out: {list(model.get_feature_names_out())}")
except Exception as e:
    report.append(f"not available: {type(e).__name__}: {e}")

# Smoke inference test replicating main.py behavior
report.append("\n### SMOKE INFERENCE (replicating main.py) ###")
import pandas as pd
sample = {
    "person_age": 30, "person_income": 55000.0, "person_home_ownership": "RENT",
    "person_emp_length": 4.0, "loan_intent": "PERSONAL", "loan_grade": "C",
    "loan_amnt": 10000.0, "loan_int_rate": 12.5, "loan_percent_income": 0.18,
    "cb_person_default_on_file": "N", "cb_person_cred_hist_length": 4,
}
df = pd.DataFrame([sample])
try:
    proba = model.predict_proba(df)[:, 1][0]
    report.append(f"predict_proba OK: {proba!r} (type {type(proba).__name__})")
    report.append(f"threshold comparison: {float(proba) >= float(threshold)}")
except Exception as e:
    report.append(f"INFERENCE FAILED: {type(e).__name__}: {e}")

# Unknown category test
report.append("\n### UNKNOWN CATEGORY TEST ###")
bad = dict(sample, person_home_ownership="CASTLE", loan_intent="WEDDING", loan_grade="Z")
try:
    p2 = model.predict_proba(pd.DataFrame([bad]))[:, 1][0]
    report.append(f"unknown categories accepted, proba={p2!r}")
except Exception as e:
    report.append(f"unknown categories REJECTED: {type(e).__name__}: {e}")

# NaN numeric test (loan_int_rate had NaNs in training)
report.append("\n### NaN NUMERIC TEST ###")
nan_sample = dict(sample, loan_int_rate=float("nan"))
try:
    p3 = model.predict_proba(pd.DataFrame([nan_sample]))[:, 1][0]
    report.append(f"NaN loan_int_rate accepted, proba={p3!r}")
except Exception as e:
    report.append(f"NaN loan_int_rate REJECTED: {type(e).__name__}: {e}")

out = "\n".join(str(x) for x in report)
print(out)
with open("/home/z/my-project/scripts/audit_artifacts_output.txt", "w") as f:
    f.write(out)
