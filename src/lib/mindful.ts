"use client";

// Mindful mode: per-device wellbeing settings and screen-time tracking, kept in localStorage.
// Nothing here is sent to the server.
import { useSyncExternalStore } from "react";

export type MindfulState = {
  /** Hide reaction, comment and vote counts on posts. */
  hideCounts: boolean;
  /** Show a break reminder after this many minutes a day; 0 = off. */
  dailyLimitMinutes: number;
  /** Seconds spent in the app per local day, e.g. { "2026-10-12": 1260 }. Last 30 days only. */
  usage: Record<string, number>;
  /** No break reminder before this time (ms since epoch). */
  snoozedUntil: number;
};

export const DAILY_LIMIT_CHOICES = [0, 15, 30, 45, 60, 90, 120];
const KEY = "mova:mindful";
const DEFAULTS: MindfulState = { hideCounts: false, dailyLimitMinutes: 0, usage: {}, snoozedUntil: 0 };

let state: MindfulState | null = null;
const listeners = new Set<() => void>();

function load(): MindfulState {
  if (state) return state;
  try {
    state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    state = DEFAULTS; // storage blocked (private mode): settings just won't persist
  }
  return state!;
}

function save(next: MindfulState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const everything = (s: MindfulState) => s;

/**
 * Reads Mindful settings. Pass a selector to re-render only when that value changes: the
 * screen-time counter updates this store every 15 seconds, and without a selector every
 * post on screen would re-render with it. Selectors must return a primitive or a value
 * stored in the state (not a new object).
 */
export function useMindful(): MindfulState;
export function useMindful<T>(select: (state: MindfulState) => T): T;
export function useMindful<T>(select: (state: MindfulState) => T = everything as (s: MindfulState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(load()),
    () => select(DEFAULTS),
  );
}

export function updateMindful(changes: Partial<Omit<MindfulState, "usage">>) {
  save({ ...load(), ...changes });
}

/** Local date as YYYY-MM-DD. */
export function dayKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addUsage(seconds: number) {
  const current = load();
  const today = dayKey();
  const usage = { ...current.usage, [today]: (current.usage[today] ?? 0) + seconds };
  const cutoff = dayKey(new Date(Date.now() - 30 * 86_400_000));
  for (const day of Object.keys(usage)) if (day < cutoff) delete usage[day];
  save({ ...current, usage });
}

/** "1h 5m", "12m", "0m" */
export function formatMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
