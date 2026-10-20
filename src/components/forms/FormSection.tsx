"use client";

import type { ReactNode } from "react";

/** Numbered form section card. */
export function FormSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-nexus-line bg-nexus-panel/60 p-4">
      <header className="mb-3.5 flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-nexus-cyan/30 bg-nexus-cyan/10 font-mono text-[11px] font-semibold text-nexus-cyan">
          {index}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-nexus-text">{title}</h3>
          <p className="text-[11px] leading-relaxed text-nexus-faint">{description}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
