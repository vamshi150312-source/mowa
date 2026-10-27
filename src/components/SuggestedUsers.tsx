"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { Avatar } from "./Avatar";

/** Horizontal "Suggested for you" strip with follow buttons. */
export function SuggestedUsers() {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getSuggestedUsers(20).then(setUsers).catch(() => setUsers([]));
  }, []);

  async function toggle(id: string) {
    const next = !following.has(id);
    const update = (on: boolean) =>
      setFollowing((s) => {
        const copy = new Set(s);
        if (on) copy.add(id);
        else copy.delete(id);
        return copy;
      });
    update(next);
    try {
      await api.setFollow(id, next);
    } catch {
      update(!next);
    }
  }

  if (users === null) {
    return (
      <div className="flex gap-2 overflow-hidden px-3 pb-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-44 w-36 shrink-0 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
    );
  }
  if (users.length === 0) return null;

  return (
    <section aria-label="Suggested for you" className="pb-3">
      <h2 className="px-4 pb-2 text-sm font-semibold">Suggested for you</h2>
      <ul className="flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {users.map((u) => {
          const isFollowing = following.has(u.id);
          return (
            <li
              key={u.id}
              className="flex w-36 shrink-0 snap-start flex-col items-center rounded-xl border border-neutral-200 px-2 py-4 text-center"
            >
              <Link href={`/u/${u.username}`} className="flex min-w-0 max-w-full flex-col items-center">
                <Avatar user={u} size="lg" />
                <span className="mt-2 max-w-full truncate text-sm font-semibold">{u.username}</span>
                <span className="max-w-full truncate text-xs text-neutral-500">{u.fullName || " "}</span>
              </Link>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className={`mt-3 w-full rounded-lg py-1.5 text-sm font-semibold ${
                  isFollowing ? "bg-neutral-100" : "bg-sky-500 text-white hover:bg-sky-600"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
