"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Reaction } from "./postOptions";
import type { Post, ReactionCounts } from "./types";

/** Moves one person's reaction from `from` to `to` (either may be null). */
function moveReaction(counts: ReactionCounts, from: Reaction | null, to: Reaction | null): ReactionCounts {
  const next = { ...counts };
  if (from) {
    next[from] = (next[from] ?? 1) - 1;
    if (!next[from]) delete next[from];
  }
  if (to) next[to] = (next[to] ?? 0) + 1;
  return next;
}

/** A post's reactions with optimistic updates. Used by feed cards and Reels. */
export function usePostReactions(post: Post) {
  const [reactions, setReactions] = useState(post.reactions);
  const [myReaction, setMyReaction] = useState(post.myReaction);
  // Bumped on every new reaction; use as a key to replay the "pop" animation.
  const [popKey, setPopKey] = useState(0);
  const pending = useRef(Promise.resolve());

  function react(next: Reaction | null) {
    const previous = myReaction;
    if (next === previous) return;
    // Optimistic update; revert if the request fails.
    setMyReaction(next);
    setReactions((r) => moveReaction(r, previous, next));
    if (next) setPopKey((k) => k + 1);
    // Serialize requests so rapid taps land in order.
    pending.current = pending.current.then(() =>
      api.setReaction(post.id, next).catch(() => {
        setMyReaction(previous);
        setReactions((r) => moveReaction(r, next, previous));
      }),
    );
  }

  const total = Object.values(reactions).reduce((sum, n) => sum + (n ?? 0), 0);
  const topReactions = (Object.entries(reactions) as [Reaction, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r]) => r);

  return { reactions, myReaction, total, topReactions, popKey, react };
}

const LONG_PRESS_MS = 450;

/**
 * Press-and-hold detection for a button that also has a normal click.
 * Spread `handlers` on the button and start its onClick with `if (wasLongPress()) return;`.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => clearTimeout(timer.current);
  const handlers = {
    onPointerDown: () => {
      fired.current = false;
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
  };
  /** True (once) if the click that's happening was the end of a long press. */
  const wasLongPress = () => {
    const was = fired.current;
    fired.current = false;
    return was;
  };
  return { handlers, wasLongPress };
}
