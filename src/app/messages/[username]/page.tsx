"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { ChatMessage, TypingBubble } from "@/components/ChatMessage";
import { BackIcon, PhoneIcon, VideoCallIcon } from "@/components/icons";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { useCalls } from "@/context/CallContext";
import { api } from "@/lib/api";
import { MESSAGE_MAX, messageTime } from "@/lib/chat";
import type { Reaction } from "@/lib/postOptions";
import type { Message, Profile } from "@/lib/types";
import { refreshUnreadChats } from "@/lib/useUnreadChats";

const POLL_MS = 2500;
/** Show a time divider when messages are this far apart. */
const GAP_MS = 60 * 60_000;

/** A message on its way to the server. */
type Pending = { key: string; body: string; failed: boolean };

export default function ChatPage() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const router = useRouter();
  const { startCall } = useCalls();
  const [other, setOther] = useState<Profile | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  // Bumped by every local change, so a poll that started before it can't undo it.
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    api
      .getProfileByUsername(decodeURIComponent(username))
      .then((p) => active && setOther(p))
      .catch(() => active && setOther(null));
    return () => {
      active = false;
    };
  }, [username]);

  const otherId = other?.id;
  const load = useCallback(() => {
    if (!otherId) return;
    const started = version.current;
    api
      .getChat(otherId)
      .then((thread) => {
        if (version.current !== started) return;
        setMessages(thread.messages);
        setTyping(thread.typing);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load messages."));
  }, [otherId]);

  useEffect(() => {
    if (!otherId) return;
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(timer);
  }, [otherId, load]);

  // Opening the chat read their messages: update the badge on the messages icon.
  const loaded = messages !== null;
  useEffect(() => {
    if (loaded) refreshUnreadChats();
  }, [loaded]);

  // Keep the newest message in view, unless you've scrolled up to read older ones.
  const count = (messages?.length ?? 0) + pending.length + (typing ? 1 : 0);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  function onScroll() {
    const el = scrollerRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(body: string, key = `p-${Date.now()}`) {
    if (!otherId || !body.trim()) return;
    version.current++;
    stickToBottom.current = true;
    setPending((p) => [...p.filter((x) => x.key !== key), { key, body, failed: false }]);
    try {
      const message = await api.sendMessage(otherId, body);
      version.current++;
      setMessages((m) => (m && !m.some((x) => x.id === message.id) ? [...m, message] : m));
      setPending((p) => p.filter((x) => x.key !== key));
    } catch (e) {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x)));
      setError(e instanceof Error ? e.message : "Couldn't send your message.");
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    void send(body);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter starts a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  // Stable, so memoized bubbles don't re-render on every poll.
  const react = useCallback(
    (id: string, reaction: Reaction | null) => {
      version.current++;
      setMessages((m) => m && m.map((x) => (x.id === id ? { ...x, reaction } : x)));
      api.reactToMessage(id, reaction).catch(load);
    },
    [load],
  );
  const unsend = useCallback(
    (id: string) => {
      version.current++;
      setMessages((m) => m && m.filter((x) => x.id !== id));
      api.unsendMessage(id).catch(load);
    },
    [load],
  );

  // Grow the text box with its content, up to about five lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  if (other === null) {
    return (
      <main className="px-6 py-20 text-center">
        <p className="text-lg font-semibold">Sorry, this person isn&apos;t available.</p>
        <Link href="/messages" className="mt-2 inline-block text-sm text-sky-500">
          Back to messages
        </Link>
      </main>
    );
  }

  // "Sent" / "Seen" goes under your message when it's the latest one.
  const lastMessage = messages?.[messages.length - 1];

  return (
    // Covers the bottom nav: the composer takes its place, like other messaging apps.
    <main className="fixed inset-x-0 top-0 z-40 mx-auto flex h-dvh max-w-md flex-col bg-white sm:border-x sm:border-neutral-200">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="p-1">
          <BackIcon />
        </button>
        {other && (
          <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-3">
            <Avatar user={other} size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{other.fullName || other.username}</span>
              <span className="block truncate text-xs text-neutral-500">{typing ? "typing…" : other.username}</span>
            </span>
          </Link>
        )}
        {other && (
          <div className="ml-auto flex items-center gap-1 pr-1">
            <button type="button" onClick={() => startCall(other, "audio")} aria-label="Audio call" className="p-2 hover:text-neutral-500">
              <PhoneIcon className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => startCall(other, "video")} aria-label="Video call" className="p-2 hover:text-neutral-500">
              <VideoCallIcon className="h-7 w-7" />
            </button>
          </div>
        )}
      </header>

      <div ref={scrollerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
        {messages === null || !other ? (
          <div className="flex justify-center py-10">{error ? <p className="text-sm text-red-500">{error}</p> : <Spinner />}</div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex flex-col items-center gap-1 pb-6 pt-2 text-center">
              <Avatar user={other} size="lg" />
              <p className="mt-1 font-semibold">{other.fullName || other.username}</p>
              <p className="text-sm text-neutral-500">{other.username} · Mova</p>
              <Link href={`/u/${other.username}`} className="mt-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold">
                View profile
              </Link>
            </div>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.senderId === me?.id;
              const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GAP_MS;
              return (
                <Fragment key={m.id}>
                  {gap && <p className="py-3 text-center text-xs font-medium text-neutral-400">{messageTime(m.createdAt)}</p>}
                  <ChatMessage
                    message={m}
                    mine={mine}
                    other={other}
                    showAvatar={!mine && (!next || next.senderId !== m.senderId)}
                    onReact={react}
                    onUnsend={unsend}
                  />
                  {m.id === lastMessage?.id && mine && pending.length === 0 && (
                    <p className="pr-1 text-right text-xs text-neutral-400">{m.readAt ? "Seen" : "Sent"}</p>
                  )}
                </Fragment>
              );
            })}
            {pending.map((p) => (
              <div key={p.key} className="flex flex-col items-end gap-0.5">
                <p className="max-w-[75%] whitespace-pre-wrap break-words rounded-3xl bg-gradient-to-br from-violet-600 to-pink-500 px-3.5 py-2 text-[15px] leading-snug text-white opacity-60">
                  {p.body}
                </p>
                {p.failed ? (
                  <button type="button" onClick={() => send(p.body, p.key)} className="pr-1 text-xs font-semibold text-red-500">
                    Not sent · Tap to retry
                  </button>
                ) : (
                  <p className="pr-1 text-xs text-neutral-400">Sending…</p>
                )}
              </div>
            ))}
            {typing && <TypingBubble other={other} />}
          </div>
        )}
      </div>

      {error && messages && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}
      <form
        onSubmit={submit}
        className="flex shrink-0 items-end gap-2 border-t border-neutral-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex min-w-0 flex-1 items-end rounded-3xl border border-neutral-200 px-4 py-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder="Message…"
            aria-label={`Message ${other?.username ?? ""}`}
            disabled={!other}
            className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-neutral-400"
          />
        </div>
        {draft.trim() ? (
          <button type="submit" className="h-10 px-2 font-semibold text-violet-600">
            Send
          </button>
        ) : (
          <button
            type="button"
            onClick={() => send("❤️")}
            disabled={!other}
            aria-label="Send a heart"
            className="h-10 px-2 text-2xl transition-transform active:scale-90"
          >
            ❤️
          </button>
        )}
      </form>
    </main>
  );
}
