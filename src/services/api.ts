/**
 * Centralized API client for the credit-risk FastAPI service.
 *
 * Routing: in the sandbox the browser reaches the service through the
 * same-origin gateway using the XTransformPort query parameter; when
 * NEXT_PUBLIC_API_BASE_URL is set (local dev / custom deployments) requests
 * go directly to that base. All paths stay relative — never absolute
 * localhost URLs.
 *
 * Guarantees:
 * - Identical in-flight predictions are deduplicated (one request, shared promise).
 * - Stale responses can never overwrite a newer result (sequence guard).
 * - Returned payloads are validated before reaching the UI.
 */
import {
  ApiError,
  type CreditRiskInput,
  type CreditRiskResult,
  type ExplainResponse,
  type FeatureImportanceResponse,
  type HealthResponse,
  type ModelInfoResponse,
} from "@/types/api";

const API_PORT = 8000;
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (BASE_URL) return `${BASE_URL}${path}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}XTransformPort=${API_PORT}`;
}

// ---------------------------------------------------------------- latency log
type LatencyListener = (latencyMs: number, endpoint: string) => void;
const latencyListeners = new Set<LatencyListener>();

export function onLatency(listener: LatencyListener): () => void {
  latencyListeners.add(listener);
  return () => latencyListeners.delete(listener);
}

function recordLatency(ms: number, endpoint: string) {
  latencyListeners.forEach((l) => l(ms, endpoint));
}

// ------------------------------------------------------------------- helpers
async function parseError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = `Request failed with status ${response.status}`;
  let details: unknown;
  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      const detail = (body as Record<string, unknown>).detail;
      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object") {
        const d = detail as Record<string, unknown>;
        code = typeof d.error_code === "string" ? d.error_code : code;
        if (typeof d.message === "string") message = d.message;
        if (d.valid_options) details = d;
      }
    }
  } catch {
    /* non-JSON body — keep defaults */
  }
  return new ApiError(message, response.status, code, details);
}

function networkError(cause: unknown, endpoint: string): ApiError {
  return new ApiError(
    `Cannot reach the inference service (${endpoint}). Verify the backend is running.`,
    0,
    "NETWORK_ERROR",
    cause instanceof Error ? cause.message : undefined
  );
}

// --------------------------------------------------------------------- health
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(apiUrl("/health"), { signal, cache: "no-store" });
  } catch (cause) {
    throw networkError(cause, "/health");
  }
  recordLatency(performance.now() - start, "/health");
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as HealthResponse;
  if (typeof body.ready !== "boolean" || typeof body.status !== "string") {
    throw new ApiError("Malformed health response", 0, "INVALID_RESPONSE");
  }
  return body;
}

// ---------------------------------------------------------------- model info
export async function fetchModelInfo(signal?: AbortSignal): Promise<ModelInfoResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/model/info"), { signal, cache: "no-store" });
  } catch (cause) {
    throw networkError(cause, "/model/info");
  }
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as ModelInfoResponse;
  if (!Array.isArray(body.feature_schema) || body.feature_schema.length !== 11) {
    throw new ApiError("Malformed model info response", 0, "INVALID_RESPONSE");
  }
  return body;
}

export async function fetchFeatureImportance(
  signal?: AbortSignal
): Promise<FeatureImportanceResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/model/feature-importance"), {
      signal,
      cache: "no-store",
    });
  } catch (cause) {
    throw networkError(cause, "/model/feature-importance");
  }
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as FeatureImportanceResponse;
  if (body.available !== true || !Array.isArray(body.features)) {
    throw new ApiError("Feature importance unavailable", 0, "UNAVAILABLE");
  }
  return body;
}

export async function explainPrediction(
  input: CreditRiskInput,
  signal?: AbortSignal
): Promise<ExplainResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/model/explain"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (cause) {
    throw networkError(cause, "/model/explain");
  }
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as ExplainResponse;
  if (!body.prediction || !Array.isArray(body.contributions)) {
    throw new ApiError("Malformed explanation response", 0, "INVALID_RESPONSE");
  }
  return body;
}

// -------------------------------------------------------------------- predict
const inflight = new Map<string, Promise<CreditRiskResult>>();
let requestSequence = 0;

export const latestPredictionSeq = () => requestSequence;

/**
 * Predict default risk. Identical concurrent submissions share a single
 * request; the returned `seq` lets callers discard responses that were
 * superseded by a newer submission.
 */
export function predictCreditRisk(
  input: CreditRiskInput
): { promise: Promise<CreditRiskResult>; seq: number } {
  const key = JSON.stringify(input);
  const seq = ++requestSequence;

  const existing = inflight.get(key);
  if (existing) return { promise: existing, seq };

  const promise = (async () => {
    const start = performance.now();
    let response: Response;
    try {
      response = await fetch(apiUrl("/predict"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (cause) {
      throw networkError(cause, "/predict");
    } finally {
      recordLatency(performance.now() - start, "/predict");
      inflight.delete(key);
    }
    if (!response.ok) throw await parseError(response);
    const body = (await response.json()) as CreditRiskResult;

    // Contract validation — never render a malformed prediction.
    const valid =
      typeof body.default_probability === "number" &&
      Number.isFinite(body.default_probability) &&
      body.default_probability >= 0 &&
      body.default_probability <= 1 &&
      (body.default_prediction === 0 || body.default_prediction === 1) &&
      typeof body.threshold === "number" &&
      Number.isFinite(body.threshold) &&
      body.threshold >= 0 &&
      body.threshold <= 1 &&
      (body.Result === "High risk" || body.Result === "Low risk") &&
      body.default_prediction === (body.default_probability >= body.threshold ? 1 : 0);
    if (!valid) {
      throw new ApiError(
        "The prediction response did not match the expected contract",
        0,
        "INVALID_RESPONSE"
      );
    }
    return body;
  })();

  inflight.set(key, promise);
  return { promise, seq };
}
