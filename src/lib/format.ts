const UNITS: [number, string][] = [
  [60 * 60 * 24 * 7, "w"],
  [60 * 60 * 24, "d"],
  [60 * 60, "h"],
  [60, "m"],
];

/** "3h", "2d", "just now" — Instagram-style relative time. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  for (const [size, label] of UNITS) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label}`;
  }
  return "just now";
}

/** 1234 -> "1,234", 12500 -> "12.5K" */
export function compactNumber(n: number): string {
  return n >= 10_000
    ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : n.toLocaleString("en");
}

/** "Tue, Oct 14, 9:00 AM" in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
