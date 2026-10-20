"use client";

import { FlaskConical, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CreditRiskInput } from "@/types/api";
import { fmtCurrency, fmtNumber } from "@/utils/format";

const LABELS: Record<keyof CreditRiskInput, string> = {
  person_age: "Age",
  person_income: "Annual income",
  person_home_ownership: "Home ownership",
  person_emp_length: "Employment length",
  loan_intent: "Loan intent",
  loan_grade: "Loan grade",
  loan_amnt: "Loan amount",
  loan_int_rate: "Interest rate",
  loan_percent_income: "Loan-to-income",
  cb_person_default_on_file: "Default on file",
  cb_person_cred_hist_length: "Credit history",
};

const prettify = (key: keyof CreditRiskInput, v: number | string): string => {
  switch (key) {
    case "person_income":
    case "loan_amnt":
      return fmtCurrency(Number(v));
    case "person_age":
    case "cb_person_cred_hist_length":
      return `${fmtNumber(Number(v))} yrs`;
    case "person_emp_length":
      return `${v} yrs`;
    case "loan_int_rate":
      return `${v}%`;
    case "loan_percent_income":
      return String(v);
    case "person_home_ownership":
      return v === "OTHER" ? "Other" : String(v).charAt(0) + String(v).slice(1).toLowerCase();
    case "loan_intent":
      return v === "DEBTCONSOLIDATION"
        ? "Debt consolidation"
        : String(v).charAt(0) + String(v).slice(1).toLowerCase();
    case "cb_person_default_on_file":
      return v === "Y" ? "Yes" : "No";
    default:
      return String(v);
  }
};

/** Confirm-before-submit: the exact payload that will be sent to the model. */
export function ReviewStep({
  values,
  onClose,
  onConfirm,
}: {
  values: CreditRiskInput | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!values} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto nexus-scroll border-nexus-line bg-nexus-deep sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-nexus-text">
            <FlaskConical className="h-4 w-4 text-nexus-cyan" aria-hidden />
            Review before analysis
          </DialogTitle>
          <DialogDescription className="text-xs">
            These 11 values will be submitted to the credit risk model exactly
            as shown.
          </DialogDescription>
        </DialogHeader>

        {values && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-nexus-line bg-nexus-panel/50 p-4">
            {(Object.keys(LABELS) as Array<keyof CreditRiskInput>).map((key) => (
              <div key={key} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-nexus-faint">
                  {LABELS[key]}
                </dt>
                <dd className="truncate font-mono text-xs text-nexus-text">
                  {prettify(key, values[key])}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="flex items-start gap-2 rounded-lg border border-nexus-line bg-nexus-panel/40 p-3 text-[11px] leading-relaxed text-nexus-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nexus-emerald/70" aria-hidden />
          Applicant data is treated as sensitive: it is sent only to this
          deployment&apos;s inference service and is never stored or logged.
        </p>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-nexus-line bg-nexus-deep text-nexus-dim hover:bg-nexus-panel hover:text-nexus-text"
          >
            Back to edit
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-gradient-to-r from-nexus-cyan to-nexus-blue font-semibold text-nexus-void hover:brightness-110"
          >
            Confirm and analyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
