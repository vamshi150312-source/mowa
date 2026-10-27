"use client";

import Link from "next/link";
import { Feed } from "@/components/Feed";
import { CreateIcon, MessagesIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { StoriesBar } from "@/components/StoriesBar";
import { useUnreadChats } from "@/lib/useUnreadChats";

export default function HomePage() {
  return (
    <main>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
        <h1 aria-label="Mova">
          <Logo />
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/create" aria-label="New post" className="p-1 hover:text-neutral-500">
            <CreateIcon />
          </Link>
          <MessagesLink />
        </div>
      </header>
      <StoriesBar />
      <Feed />
    </main>
  );
}

/** Its own component, so the unread count re-renders only this icon, not the feed. */
function MessagesLink() {
  const unread = useUnreadChats();
  return (
    <Link
      href="/messages"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      className="relative p-1 hover:text-neutral-500"
    >
      <MessagesIcon />
      {unread > 0 && (
        <span className="absolute -right-1 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
