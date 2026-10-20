import { afterEach, describe, expect, it, vi } from "vitest";
import { predictCreditRisk, apiUrl } from "@/services/api";
import type { CreditRiskInput } from "@/types/api";

const INPUT: CreditRiskInput = {
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
};

const VALID_RESPONSE = {
  default_probability: 0.957,
  default_prediction: 1,
  threshold: 0.7158,
  Result: "High risk",
};

function mockFetch(responder: () => Promise<Response>) {
  const fetchMock = vi.fn(responder);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiUrl routing", () => {
  it("appends the gateway port parameter to relative paths", () => {
    expect(apiUrl("/predict")).toBe("/predict?XTransformPort=8000");
    expect(apiUrl("/model/info")).toBe("/model/info?XTransformPort=8000");
  });
});

describe("predictCreditRisk", () => {
  it("sends the exact 11-field payload with correct headers", async () => {
    const fetchMock = mockFetch(
      () => Promise.resolve(new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }))
    );
    await predictCreditRisk(INPUT).promise;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/predict?XTransformPort=8000");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(INPUT);
  });

  it("deduplicates identical concurrent submissions", async () => {
    let resolveFn!: (r: Response) => void;
    const fetchMock = mockFetch(
      () => new Promise<Response>((res) => (resolveFn = res))
    );
    const a = predictCreditRisk(INPUT);
    const b = predictCreditRisk(INPUT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFn(new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }));
    const [ra, rb] = await Promise.all([a.promise, b.promise]);
    expect(ra).toEqual(rb);
  });

  it("rejects malformed probabilities (contract validation)", async () => {
    mockFetch(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ ...VALID_RESPONSE, default_probability: 1.5 }), {
            status: 200,
          })
        )
    );
    await expect(predictCreditRisk(INPUT).promise).rejects.toThrow(
      "did not match the expected contract"
    );
  });

  it("rejects inconsistent classification (probability vs threshold)", async () => {
    mockFetch(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ ...VALID_RESPONSE, default_prediction: 0 }),
            { status: 200 }
          )
        )
    );
    await expect(predictCreditRisk(INPUT).promise).rejects.toThrow();
  });

  it("normalizes network failures into actionable errors", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(predictCreditRisk(INPUT).promise).rejects.toThrow(
      /Cannot reach the inference service/
    );
  });

  it("surfaces validation errors with structured details", async () => {
    mockFetch(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                error_code: "INVALID_CATEGORY",
                message: "'Z' is not a category the model was trained on.",
                valid_options: ["A", "B"],
              },
            }),
            { status: 422 }
          )
        )
    );
    const err = await predictCreditRisk(INPUT).promise.catch((e) => e);
    expect(err.code).toBe("INVALID_CATEGORY");
    expect(err.details).toMatchObject({ valid_options: ["A", "B"] });
  });

  it("returns increasing sequence numbers for stale-response guarding", () => {
    mockFetch(
      () => Promise.resolve(new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }))
    );
    const a = predictCreditRisk(INPUT);
    const b = predictCreditRisk({ ...INPUT, loan_grade: "A" });
    expect(b.seq).toBeGreaterThan(a.seq);
  });
});
