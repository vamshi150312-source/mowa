"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { MESSAGE_MAX } from "@/lib/chat";
import type { Post, Profile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CheckIcon, CloseIcon, SearchIcon } from "./icons";
import { Spinner } from "./Spinner";

/**
 * Bottom sheet for the Share button: send the post to one or more people in Messages,
 * copy its link, or use the device's share menu.
 */
export function SendToSheet({
  post,
  path = `/p/${post.id}`,
  onClose,
}: {
  post: Post;
  /** Where "Copy link" points; the post page by default. */
  path?: string;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${path}`;

  // People you chat with first, then suggestions.
  useEffect(() => {
    let active = true;
    Promise.all([api.getChats().catch(() => []), api.getSuggestedUsers(12).catch(() => [])]).then(([chats, suggested]) => {
      if (!active) return;
      const list = [...chats.map((c) => c.user), ...suggested];
      setPeople(list.filter((p, i) => p.id !== me?.id && list.findIndex((x) => x.id === p.id) === i).slice(0, 15));
    });
    return () => {
      active = false;
    };
  }, [me?.id]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return setResults(null);
    let active = true;
    const timer = setTimeout(() => {
      api
        .searchUsers(q)
        .then((users) => active && setResults(users.filter((u) => u.id !== me?.id)))
        .catch(() => active && setResults([]));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, me?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (p: Profile) =>
    setSelected((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]));

  async function send() {
    setStatus("sending");
    setError(null);
    const text = note.trim();
    const results = await Promise.allSettled(
      selected.map(async (p) => {
        await api.sendMessage(p.id, "", post.id);
        if (text) await api.sendMessage(p.id, text);
      }),
    );
    const failed = results.flatMap((r, i) => (r.status === "rejected" ? [{ person: selected[i], reason: r.reason }] : []));
    if (failed.length) {
      // Keep only the people it didn't reach, so trying again doesn't send twice.
      setSelected(failed.map((f) => f.person));
      setStatus("idle");
      setError(failed[0].reason instanceof Error ? failed[0].reason.message : "Couldn't send.");
      return;
    }
    setStatus("sent");
    setTimeout(onClose, 900);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const list = results ?? people;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Share">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="animate-sheet-up relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl bg-white text-neutral-900">
        <div className="relative flex items-center justify-center border-b border-neutral-100 py-3">
          <span className="absolute top-1.5 h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
          <h2 className="pt-1 text-sm font-semibold">Share</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-2.5 p-1">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <label className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2">
            <SearchIcon className="h-4 w-4 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search people"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
          </label>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto py-2">
          {list === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">No one found.</p>
          ) : (
            <ul aria-label="People">
              {list.map((p) => {
                const on = selected.some((x) => x.id === p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50"
                    >
                      <Avatar user={p} size="md" />
                      <span className="min-w-0 flex-1 text-sm leading-tight">
                        <span className="block truncate font-semibold">{p.fullName || p.username}</span>
                        <span className="block truncate text-neutral-500">{p.username}</span>
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          on ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300"
                        }`}
                      >
                        {on && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {selected.length > 0 ? (
            <div className="space-y-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={MESSAGE_MAX}
                placeholder="Write a message…"
                aria-label="Message"
                className="w-full text-sm outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={send}
                disabled={status !== "idle"}
                className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-70"
              >
                {status === "sent"
                  ? "Sent ✓"
                  : status === "sending"
                    ? "Sending…"
                    : selected.length === 1
                      ? `Send to ${selected[0].username}`
                      : `Send separately to ${selected.length} people`}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-semibold hover:bg-neutral-200"
              >
                {copied ? "Link copied" : "Copy link"}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  type="button"
                  onClick={() => navigator.share({ url, title: `Post by ${post.author.username}` }).catch(() => {})}
                  className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-semibold hover:bg-neutral-200"
                >
                  More options
                </button>
              )}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
