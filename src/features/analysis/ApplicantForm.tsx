"use client";

import { useCallback, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, RotateCcw, Play, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CreditRiskInput } from "@/types/api";
import {
  creditRiskSchema,
  DEFAULT_ON_FILE_OPTIONS,
  HOME_OWNERSHIP_OPTIONS,
  LOAN_GRADE_OPTIONS,
  LOAN_INTENT_OPTIONS,
  SAMPLE_PROFILES,
  TRAINING_RANGES,
  type CreditRiskFormValues,
  type CreditRiskParsedValues,
} from "@/schemas/creditRisk";
import { FormSection } from "@/components/forms/FormSection";
import { NumberInput } from "@/components/forms/NumberInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { ReviewStep } from "./ReviewStep";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { fmtCurrency } from "@/utils/format";

const EMPTY: CreditRiskFormValues = {
  person_age: "",
  person_income: "",
  person_home_ownership: "",
  person_emp_length: "",
  loan_intent: "",
  loan_grade: "",
  loan_amnt: "",
  loan_int_rate: "",
  loan_percent_income: "",
  cb_person_default_on_file: "",
  cb_person_cred_hist_length: "",
};

const prettify = (v: string) =>
  v === "N" ? "No" : v === "Y" ? "Yes" : v.charAt(0) + v.slice(1).toLowerCase();

const prettifyIntent = (v: string) =>
  v === "DEBTCONSOLIDATION"
    ? "Debt consolidation"
    : v.charAt(0) + v.slice(1).toLowerCase();

const range = (r: { min: number; max: number }) => `range ${r.min}–${r.max}`;

export function ApplicantForm({
  onAnalyze,
  disabled,
}: {
  onAnalyze: (input: CreditRiskInput) => void;
  disabled?: boolean;
}) {
  const [review, setReview] = useState<CreditRiskParsedValues | null>(null);
  const setSoftState = useCharacterStore((s) => s.setSoftState);

  const form = useForm<CreditRiskFormValues, unknown, CreditRiskParsedValues>({
    resolver: zodResolver(creditRiskSchema),
    defaultValues: EMPTY,
    mode: "onBlur",
  });

  const { register, handleSubmit, control, formState, setValue, reset, trigger } = form;
  const errors = formState.errors;

  const incomeValue = useWatch({ control, name: "person_income" });
  const amntValue = useWatch({ control, name: "loan_amnt" });
  const ownershipValue = useWatch({ control, name: "person_home_ownership" });
  const allValues = useWatch({ control });

  const computeRatio = useCallback(async () => {
    const income = Number(incomeValue);
    const amnt = Number(amntValue);
    if (
      Number.isFinite(income) && Number.isFinite(amnt) &&
      income > 0 && amnt >= 0
    ) {
      const ratio = Math.min(0.83, Math.round((amnt / income) * 100) / 100);
      setValue("loan_percent_income", String(ratio), { shouldValidate: true });
    } else {
      await trigger("loan_percent_income");
    }
  }, [incomeValue, amntValue, setValue, trigger]);

  const loadSample = useCallback(
    (id: string) => {
      const sample = SAMPLE_PROFILES.find((s) => s.id === id);
      if (!sample) return;
      reset(
        Object.fromEntries(
          Object.entries(sample.values).map(([k, v]) => [k, String(v)])
        ) as unknown as CreditRiskFormValues
      );
    },
    [reset]
  );

  const openReview = handleSubmit((values) => setReview(values));

  const confirmReview = useCallback(() => {
    if (!review) return;
    setReview(null);
    onAnalyze(review as unknown as CreditRiskInput);
  }, [review, onAnalyze]);

  const filledCount = useMemo(
    () => Object.values(allValues ?? {}).filter((v) => String(v).trim() !== "").length,
    [allValues]
  );

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(e) => void openReview(e)}
      onFocusCapture={() => setSoftState("listening")}
      onBlurCapture={() => setSoftState("idle")}
      noValidate
    >
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto nexus-scroll p-4">
        <FormSection
          index={1}
          title="Personal profile"
          description="Applicant demographics used by the model."
        >
          <NumberInput
            label="Age"
            required
            unit="years"
            placeholder="e.g. 35"
            hint={range(TRAINING_RANGES.person_age)}
            error={errors.person_age?.message}
            {...register("person_age")}
          />
          <SelectInput
            label="Home ownership"
            required
            placeholder="Select status"
            options={HOME_OWNERSHIP_OPTIONS}
            format={prettify}
            hint="4 categories from training"
            error={errors.person_home_ownership?.message}
            value={ownershipValue ?? ""}
            onValueChange={(v) => setValue("person_home_ownership", v, { shouldValidate: true })}
          />
        </FormSection>

        <FormSection
          index={2}
          title="Employment & income"
          description="Ability to repay: earnings and job stability."
        >
          <NumberInput
            label="Annual income"
            required
            unit="USD"
            placeholder="e.g. 72000"
            hint={
              Number.isFinite(Number(incomeValue)) && Number(incomeValue) > 0
                ? fmtCurrency(Number(incomeValue))
                : range(TRAINING_RANGES.person_income)
            }
            error={errors.person_income?.message}
            {...register("person_income")}
          />
          <NumberInput
            label="Employment length"
            required
            unit="years"
            placeholder="e.g. 8"
            hint={`cannot exceed age · ${range(TRAINING_RANGES.person_emp_length)}`}
            error={errors.person_emp_length?.message}
            {...register("person_emp_length")}
          />
        </FormSection>

        <FormSection
          index={3}
          title="Loan information"
          description="The credit request being assessed."
        >
          <Controller
            control={control}
            name="loan_intent"
            render={({ field }) => (
              <SelectInput
                label="Loan intent"
                required
                placeholder="Select purpose"
                options={LOAN_INTENT_OPTIONS}
                format={prettifyIntent}
                hint="6 categories from training"
                error={errors.loan_intent?.message}
                value={field.value ?? ""}
                onValueChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="loan_grade"
            render={({ field }) => (
              <SelectInput
                label="Loan grade"
                required
                placeholder="Select grade"
                options={LOAN_GRADE_OPTIONS}
                hint="A (best) → G (worst)"
                error={errors.loan_grade?.message}
                value={field.value ?? ""}
                onValueChange={field.onChange}
              />
            )}
          />
          <NumberInput
            label="Loan amount"
            required
            unit="USD"
            placeholder="e.g. 12000"
            hint={
              Number.isFinite(Number(amntValue)) && Number(amntValue) > 0
                ? fmtCurrency(Number(amntValue))
                : range(TRAINING_RANGES.loan_amnt)
            }
            error={errors.loan_amnt?.message}
            {...register("loan_amnt")}
          />
          <NumberInput
            label="Interest rate"
            required
            unit="%"
            step="0.01"
            placeholder="e.g. 10.9"
            hint={range(TRAINING_RANGES.loan_int_rate)}
            error={errors.loan_int_rate?.message}
            {...register("loan_int_rate")}
          />
          <div className="relative">
            <NumberInput
              label="Loan-to-income ratio"
              required
              unit="ratio"
              step="0.01"
              placeholder="e.g. 0.17"
              hint="loan amount ÷ annual income"
              error={errors.loan_percent_income?.message}
              {...register("loan_percent_income")}
            />
            <button
              type="button"
              onClick={() => void computeRatio()}
              title="Compute from loan amount and income"
              className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-md border border-nexus-line bg-nexus-panel px-1.5 py-0.5 text-[9px] text-nexus-dim transition-colors hover:border-nexus-cyan/40 hover:text-nexus-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
            >
              <Calculator className="h-2.5 w-2.5" aria-hidden />
              compute
            </button>
          </div>
        </FormSection>

        <FormSection
          index={4}
          title="Credit history"
          description="Bureau signals from the applicant's credit file."
        >
          <Controller
            control={control}
            name="cb_person_default_on_file"
            render={({ field }) => (
              <SelectInput
                label="Historical default on file"
                required
                placeholder="Select"
                options={DEFAULT_ON_FILE_OPTIONS}
                format={prettify}
                hint="previous bureau default record"
                error={errors.cb_person_default_on_file?.message}
                value={field.value ?? ""}
                onValueChange={field.onChange}
              />
            )}
          />
          <NumberInput
            label="Credit history length"
            required
            unit="years"
            placeholder="e.g. 9"
            hint={range(TRAINING_RANGES.cb_person_cred_hist_length)}
            error={errors.cb_person_cred_hist_length?.message}
            {...register("cb_person_cred_hist_length")}
          />
        </FormSection>
      </div>

      {/* sticky actions */}
      <div className="shrink-0 border-t border-nexus-line bg-nexus-panel/80 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-nexus-line bg-nexus-deep px-3 text-xs font-medium text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
              disabled={disabled}
            >
              <Play className="h-3.5 w-3.5" aria-hidden />
              Sample
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="border-nexus-line bg-nexus-deep">
              <DropdownMenuLabel className="text-[10px] text-nexus-faint">
                Illustrative profiles (valid values)
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-nexus-line" />
              {SAMPLE_PROFILES.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onSelect={() => loadSample(s.id)}
                  className="flex flex-col items-start gap-0.5 focus:bg-nexus-raised"
                >
                  <span className="text-xs font-medium text-nexus-text">{s.name}</span>
                  <span className="text-[10px] text-nexus-faint">{s.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => reset(EMPTY)}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-nexus-line bg-nexus-deep px-3 text-xs font-medium text-nexus-dim transition-colors hover:border-nexus-line-strong hover:text-nexus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>

          <button
            type="submit"
            disabled={disabled}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-blue px-4 text-xs font-semibold text-nexus-void transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan/60 disabled:opacity-50"
          >
            Review &amp; analyze
            <span className="font-mono text-[10px] opacity-70">{filledCount}/11</span>
          </button>
        </div>
      </div>

      <ReviewStep
        values={review}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
      />
    </form>
  );
}
