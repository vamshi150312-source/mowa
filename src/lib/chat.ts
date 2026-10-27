// Direct-message helpers shared by the UI and both backends.
import type { CallRecord, Message } from "./types";

export const MESSAGE_MAX = 1000;

/** One-line preview of a message for the inbox, e.g. "You: See you there" or "Sent a post". */
export function messagePreview(message: Message, meId: string | undefined): string {
  const mine = message.senderId === meId;
  if (message.call) return callLabel(message.call, mine);
  const text = message.body || (message.post || message.postUnavailable ? (mine ? "Sent a post" : "Shared a post") : "");
  return mine && message.body ? `You: ${text}` : text;
}

/** "Video call · 2:31", "Missed audio call", "You declined a video call"... from one side's point of view. */
export function callLabel(call: CallRecord, iCalled: boolean): string {
  const kind = call.kind === "video" ? "video call" : "audio call";
  if (call.outcome === "completed") return `${capitalize(kind)} · ${formatDuration(call.durationSec)}`;
  if (call.outcome === "declined") return iCalled ? `${capitalize(kind)} declined` : `You declined a ${kind}`;
  return iCalled ? `${capitalize(kind)} not answered` : `Missed ${kind}`;
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "9:41 AM" today, "Tue 9:41 AM" this week, otherwise "Oct 3, 9:41 AM". */
export function messageTime(iso: string): string {
  const date = new Date(iso);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  const time = date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  if (days < 6) return `${date.toLocaleDateString("en", { weekday: "short" })} ${time}`;
  return `${date.toLocaleDateString("en", { month: "short", day: "numeric" })}, ${time}`;
}
