"use client";

import { useEffect, useState } from "react";
import { addUsage, dayKey, formatMinutes, updateMindful, useMindful } from "@/lib/mindful";
import { LogoMark } from "./Logo";

const TICK_SECONDS = 15;
const BREATHER_SECONDS = 60;
const SNOOZE_MS = 15 * 60_000;

/**
 * Counts time spent in the app (while the tab is visible) and, once the daily limit set in
 * Settings → Mindful mode is reached, offers a break with a one-minute breathing exercise.
 */
export function MindfulBreak() {
  const { dailyLimitMinutes, usage, snoozedUntil } = useMindful();
  const [stage, setStage] = useState<"idle" | "breathe" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") addUsage(TICK_SECONDS);
    }, TICK_SECONDS * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage !== "breathe") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === "breathe" && elapsed >= BREATHER_SECONDS) setStage("done");
  }, [stage, elapsed]);

  const today = usage[dayKey()] ?? 0;
  // Re-evaluated on every usage tick, which re-renders this component.
  const due = dailyLimitMinutes > 0 && today >= dailyLimitMinutes * 60 && Date.now() >= snoozedUntil;
  if (!due && stage === "idle") return null;

  const snooze = (ms: number) => updateMindful({ snoozedUntil: Date.now() + ms });
  function notToday() {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    updateMindful({ snoozedUntil: midnight.getTime() });
  }
  function startBreather() {
    snooze(SNOOZE_MS); // so the prompt doesn't come straight back afterwards
    setElapsed(0);
    setStage("breathe");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50 px-6"
    >
      <div className="w-full max-w-sm text-center">
        {stage === "idle" && (
          <>
            <LogoMark className="mx-auto h-14 w-14" />
            <h2 id="break-title" className="mt-5 text-2xl font-bold">
              Time for a break?
            </h2>
            <p className="mt-2 text-neutral-600">
              You&apos;ve spent <span className="font-semibold">{formatMinutes(today)}</span> on Mova today, past the{" "}
              {dailyLimitMinutes}-minute reminder you set. Stretch, grab some water, or try a quick breather.
            </p>
            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={startBreather}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-pink-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-md"
              >
                Take a 1-minute breather
              </button>
              <button
                type="button"
                onClick={() => snooze(SNOOZE_MS)}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold shadow-sm"
              >
                Remind me in 15 minutes
              </button>
              <button type="button" onClick={notToday} className="w-full py-2 text-sm text-neutral-500">
                Don&apos;t remind me again today
              </button>
            </div>
          </>
        )}

        {stage === "breathe" && (
          <>
            <h2 id="break-title" className="sr-only">
              Breathing exercise
            </h2>
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
              <div className="animate-breathe absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 via-pink-400 to-orange-300 opacity-80" />
              <p className="relative text-xl font-semibold text-white" aria-live="polite">
                {Math.floor(elapsed / 4) % 2 === 0 ? "Breathe in" : "Breathe out"}
              </p>
            </div>
            <p className="mt-8 text-sm text-neutral-500">{BREATHER_SECONDS - elapsed}s left</p>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="mt-4 text-sm font-semibold text-neutral-600"
            >
              Stop
            </button>
          </>
        )}

        {stage === "done" && (
          <>
            <p className="text-5xl" aria-hidden>
              🌿
            </p>
            <h2 id="break-title" className="mt-4 text-2xl font-bold">
              Nicely done
            </h2>
            <p className="mt-2 text-neutral-600">We&apos;ll check in again in 15 minutes.</p>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold shadow-sm"
            >
              Back to Mova
            </button>
          </>
        )}
      </div>
    </div>
  );
}
