"use client";

import { forwardRef, useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  unit?: string;
  required?: boolean;
}

/** Labelled numeric field with unit suffix, hint and inline validation. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ label, error, hint, unit, required, className, id, ...props }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="flex items-center gap-1 text-[11px] font-medium text-nexus-dim"
        >
          {label}
          {required && (
            <span className="text-nexus-cyan" aria-hidden>
              *
            </span>
          )}
        </label>
        <div
          className={cn(
            "group relative flex items-center rounded-lg border bg-nexus-deep transition-colors focus-within:border-nexus-cyan/60 focus-within:ring-2 focus-within:ring-nexus-cyan/25",
            error
              ? "border-nexus-red/60"
              : "border-nexus-line hover:border-nexus-line-strong"
          )}
        >
          <input
            ref={ref}
            id={fieldId}
            type="number"
            inputMode="decimal"
            step="any"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={cn(
              "h-9 w-full rounded-lg bg-transparent px-3 text-sm text-nexus-text outline-none placeholder:text-nexus-faint/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              unit && "pr-14",
              className
            )}
            {...props}
          />
          {unit && (
            <span className="pointer-events-none absolute right-3 font-mono text-[10px] uppercase tracking-wide text-nexus-faint">
              {unit}
            </span>
          )}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="flex items-start gap-1 text-[11px] text-nexus-red">
            <CircleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="font-mono text-[10px] text-nexus-faint/80">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
