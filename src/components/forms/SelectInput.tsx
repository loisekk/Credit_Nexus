"use client";

import { useId } from "react";
import { CircleAlert, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SelectInputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  format?: (option: string) => string;
  id?: string;
}

/** Labelled categorical select — options come from the model's encoder. */
export function SelectInput({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  error,
  hint,
  required,
  format,
  id,
}: SelectInputProps) {
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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-9 border-nexus-line bg-nexus-deep text-sm text-nexus-text hover:border-nexus-line-strong focus:ring-nexus-cyan/25",
            error && "border-nexus-red/60"
          )}
        >
          <SelectValue placeholder={placeholder} />
          <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        </SelectTrigger>
        <SelectContent className="border-nexus-line bg-nexus-deep text-nexus-text">
          {options.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="focus:bg-nexus-raised focus:text-nexus-cyan"
            >
              {format ? format(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-[11px] text-nexus-red">
          <CircleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[10px] text-nexus-faint/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
