"use client";

import { create } from "zustand";

export type TimelineEventKind =
  | "session"
  | "view"
  | "submit"
  | "result"
  | "error"
  | "health"
  | "system";

export interface TimelineEvent {
  id: number;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  at: number;
}

interface TimelineState {
  events: TimelineEvent[];
  push: (kind: TimelineEventKind, title: string, detail?: string) => void;
  clear: () => void;
}

let nextId = 1;

export const useTimelineStore = create<TimelineState>((set) => ({
  events: [],
  push: (kind, title, detail) =>
    set((state) => ({
      events: [{ id: nextId++, kind, title, detail, at: Date.now() }, ...state.events].slice(
        0,
        60
      ),
    })),
  clear: () => set({ events: [] }),
}));
