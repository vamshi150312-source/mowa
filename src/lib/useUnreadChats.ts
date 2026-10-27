"use client";

// How many chats have unread messages, for the badge on the messages icon. One shared poll
// for the whole app, running only while something shows the badge and the tab is visible.
import { useSyncExternalStore } from "react";
import { api } from "./api";

const POLL_MS = 15_000;
let count = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

/** Fetches the count now, e.g. after reading a chat. */
export function refreshUnreadChats() {
  api
    .getUnreadChatCount()
    .then((next) => {
      if (next === count) return;
      count = next;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshUnreadChats();
    timer = setInterval(() => document.visibilityState === "visible" && refreshUnreadChats(), POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(timer);
  };
}

export function useUnreadChats(): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}
