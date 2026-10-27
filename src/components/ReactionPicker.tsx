"use client";

import { useEffect } from "react";
import { REACTION_NAMES, REACTIONS, type Reaction } from "@/lib/postOptions";

/**
 * Row of emoji reactions that pops up next to a reaction button: above it ("above", feed
 * posts) or to its left ("left", the Reels side rail). Tap outside or press Escape to close.
 */
export function ReactionPicker({
  selected,
  onPick,
  onClose,
  placement = "above",
}: {
  selected: Reaction | null;
  onPick: (reaction: Reaction) => void;
  onClose: () => void;
  placement?: "above" | "left";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="menu"
        aria-label="Pick a reaction"
        className={`animate-picker-in absolute z-40 flex gap-0.5 rounded-full border border-neutral-200 bg-white p-1 shadow-lg ${
          placement === "above" ? "bottom-full left-1.5 mb-1 origin-bottom-left" : "right-full top-0 mr-2 origin-right"
        }`}
      >
        {REACTIONS.map((reaction, i) => (
          <button
            key={reaction}
            type="button"
            role="menuitemradio"
            aria-checked={selected === reaction}
            aria-label={REACTION_NAMES[reaction]}
            title={REACTION_NAMES[reaction]}
            onClick={() => onPick(reaction)}
            style={{ animationDelay: `${i * 35}ms` }}
            className={`animate-emoji-in flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform duration-150 hover:-translate-y-1 hover:scale-125 ${
              selected === reaction ? "bg-neutral-100" : ""
            }`}
          >
            {reaction}
          </button>
        ))}
      </div>
    </>
  );
}
