"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SearchIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { messagePreview } from "@/lib/chat";
import { timeAgo } from "@/lib/format";
import type { ChatSummary, Profile } from "@/lib/types";

const POLL_MS = 5000;

export default function MessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);

  const load = useCallback(() => {
    api
      .getChats()
      .then((c) => {
        setChats(c);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your messages."));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Search people to start a new chat with.
  useEffect(() => {
    const q = query.trim();
    if (!q) return setResults(null);
    let active = true;
    const timer = setTimeout(() => {
      api
        .searchUsers(q)
        .then((users) => active && setResults(users.filter((u) => u.id !== user?.id)))
        .catch(() => active && setResults([]));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, user?.id]);

  return (
    <main>
      <PageHeader title={user?.username ?? "Messages"} back />
      <div className="px-4 py-3">
        <label className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2">
          <SearchIcon className="h-4 w-4 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people to message"
            aria-label="Search people to message"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
          />
        </label>
      </div>

      {results ? (
        <ul aria-label="People">
          {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-neutral-500">No one found.</li>}
          {results.map((u) => (
            <li key={u.id}>
              <Link href={`/messages/${u.username}`} className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                <Avatar user={u} size="md" />
                <span className="min-w-0 text-sm leading-tight">
                  <span className="block truncate font-semibold">{u.username}</span>
                  <span className="block truncate text-neutral-500">{u.fullName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h2 className="px-4 pb-1 pt-2 text-base font-bold">Messages</h2>
          {error && <p className="px-4 py-2 text-sm text-red-500">{error}</p>}
          {chats === null ? (
            !error && <ChatListSkeleton />
          ) : chats.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold">No messages yet</p>
              <p className="mt-1 text-sm text-neutral-500">Search for someone above to start a chat, or share a post with a friend.</p>
            </div>
          ) : (
            <ul aria-label="Chats">
              {chats.map((chat) => (
                <ChatRow key={chat.user.id} chat={chat} meId={user?.id} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function ChatRow({ chat, meId }: { chat: ChatSummary; meId: string | undefined }) {
  const { user, lastMessage, unread } = chat;
  const seen = lastMessage.senderId === meId && lastMessage.readAt;
  return (
    <li>
      <Link href={`/messages/${user.username}`} className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50">
        <Avatar user={user} size="md" />
        <span className="min-w-0 flex-1 text-sm leading-tight">
          <span className={`block truncate ${unread ? "font-bold" : "font-medium"}`}>{user.fullName || user.username}</span>
          <span className={`flex gap-1 ${unread ? "font-semibold text-neutral-900" : "text-neutral-500"}`}>
            <span className="truncate">
              {unread > 1 ? `${unread} new messages` : messagePreview(lastMessage, meId)}
            </span>
            <span className="shrink-0">
              · {seen ? "Seen " : ""}
              {timeAgo(lastMessage.createdAt)}
            </span>
          </span>
        </span>
        {unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-500" aria-label="Unread" />}
      </Link>
    </li>
  );
}

function ChatListSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <div className="h-11 w-11 rounded-full bg-neutral-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-neutral-200" />
            <div className="h-3 w-44 rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
