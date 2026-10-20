"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHealth } from "@/services/api";
import { useHealthStore } from "@/stores/useHealthStore";
import { useTimelineStore } from "@/stores/useTimelineStore";

const POLL_INTERVAL_MS = 15000;

/** Polls backend health; records state transitions into the activity timeline. */
export function useHealthPolling(): void {
  const setHealth = useHealthStore((s) => s.setHealth);
  const pushEvent = useTimelineStore((s) => s.push);
  const prevStatus = useRef<string | null>(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    try {
      const health = await fetchHealth();
      if (!mounted.current) return;
      setHealth(health);
    } catch {
      if (!mounted.current) return;
      setHealth(null);
    }
  }, [setHealth]);

  useEffect(() => {
    mounted.current = true;
    void check();
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Log status transitions (online <-> offline <-> degraded)
  const status = useHealthStore((s) => s.status);
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== status) {
      pushEvent("health", `Backend ${status}`, `Previously ${prevStatus.current}`);
    }
    prevStatus.current = status;
  }, [status, pushEvent]);
}
