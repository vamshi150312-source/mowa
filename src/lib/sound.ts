import { useSyncExternalStore } from "react";

// One sound setting shared by every video in the app: unmute one, and the rest play with sound too.
let soundOn = false;
const listeners = new Set<() => void>();

export function setSoundOn(on: boolean) {
  soundOn = on;
  listeners.forEach((l) => l());
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => soundOn,
    () => false,
  );
}
