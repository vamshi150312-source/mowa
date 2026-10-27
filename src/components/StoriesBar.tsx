"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { StoryGroup } from "@/lib/types";
import { Avatar } from "./Avatar";
import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";

/** Mark one story as seen in a list of groups (and update the group's allSeen). */
export function markSeen(groups: StoryGroup[], storyId: string): StoryGroup[] {
  return groups.map((g) => {
    if (!g.stories.some((s) => s.id === storyId)) return g;
    const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
    return { ...g, stories, allSeen: stories.every((s) => s.seen) };
  });
}

/** Remove a deleted story (and its group if it was the last one). */
export function removeStory(groups: StoryGroup[], storyId: string): StoryGroup[] {
  return groups
    .map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) }))
    .filter((g) => g.stories.length > 0);
}

/** "Your story" plus everyone with active stories, as a horizontal row of rings. */
export function StoriesBar() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);

  const load = useCallback(() => {
    api.getStories().then(setGroups, () => setGroups([]));
  }, []);
  useEffect(load, [load]);

  const close = useCallback(() => {
    setOpenAt(null);
    load(); // re-sort: people you just watched move to the end
  }, [load]);
  const seen = useCallback((id: string) => setGroups((g) => g && markSeen(g, id)), []);
  const deleted = useCallback((id: string) => setGroups((g) => g && removeStory(g, id)), []);

  if (!user) return null;
  if (groups === null) {
    return (
      <div className="flex gap-3 overflow-hidden border-b border-neutral-100 px-3 py-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[72px] shrink-0 animate-pulse flex-col items-center gap-1.5">
            <div className="h-[72px] w-[72px] rounded-full bg-neutral-200" />
            <div className="h-2.5 w-12 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    );
  }

  const myIndex = groups.findIndex((g) => g.author.id === user.id);
  const mine = myIndex >= 0 ? groups[myIndex] : null;

  return (
    <>
      <ul aria-label="Stories" className="flex gap-3 overflow-x-auto border-b border-neutral-100 px-3 py-3 [scrollbar-width:none]">
        <li className="w-[72px] shrink-0">
          <div className="relative mx-auto w-fit">
            {mine ? (
              <button type="button" onClick={() => setOpenAt(myIndex)} aria-label="View your story">
                <StoryRing seen={mine.allSeen}>
                  <Avatar user={user} size="story" />
                </StoryRing>
              </button>
            ) : (
              <Link href="/create?mode=story" aria-label="Add to your story" className="block p-[4.5px]">
                <Avatar user={user} size="story" />
              </Link>
            )}
            <Link
              href="/create?mode=story"
              aria-label="Add to your story"
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-base font-bold leading-none text-white"
            >
              +
            </Link>
          </div>
          <p className="mt-1 truncate text-center text-xs text-neutral-600">Your story</p>
        </li>

        {groups.map((g, i) =>
          g.author.id === user.id ? null : (
            <li key={g.author.id} className="w-[72px] shrink-0">
              <button
                type="button"
                onClick={() => setOpenAt(i)}
                aria-label={`View ${g.author.username}'s story${g.allSeen ? "" : " (new)"}`}
                className="mx-auto block w-fit"
              >
                <StoryRing seen={g.allSeen}>
                  <Avatar user={g.author} size="story" />
                </StoryRing>
              </button>
              <p className={`mt-1 truncate text-center text-xs ${g.allSeen ? "text-neutral-500" : "text-neutral-900"}`}>
                {g.author.username}
              </p>
            </li>
          ),
        )}
      </ul>

      {openAt !== null && groups[openAt] && (
        <StoryViewer groups={groups} startGroup={openAt} onClose={close} onSeen={seen} onDeleted={deleted} />
      )}
    </>
  );
}
