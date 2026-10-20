"use client";

/** Branded loading screen shown while the workstation bundle loads. */
export function HexagonSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-nexus-void">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-[30%] border border-nexus-cyan/40" />
        <div className="absolute inset-2 rounded-[30%] border border-nexus-violet/30" />
        <span className="font-mono text-lg font-semibold tracking-widest text-nexus-cyan">
          N
        </span>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium tracking-[0.3em] text-nexus-dim">
          CREDITNEXUS AI
        </p>
        <p className="text-xs text-nexus-faint">Initializing analysis chamber…</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-nexus-raised">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-violet" />
      </div>
    </div>
  );
}
