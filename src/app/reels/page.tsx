"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateIcon, ReelsIcon } from "@/components/icons";
import { ReelPlayer } from "@/components/ReelPlayer";
import { Spinner } from "@/components/Spinner";
import { api } from "@/lib/api";
import { setSoundOn, useSoundOn } from "@/lib/sound";
import type { Post } from "@/lib/types";
import { useInfinitePosts } from "@/lib/useInfinitePosts";

const PAGE_SIZE = 6;

export default function ReelsPage() {
  return (
    <Suspense fallback={<ReelsFrame />}>
      <Reels />
    </Suspense>
  );
}

/** Full-height black frame between the top of the screen and the bottom nav. */
function ReelsFrame({ children }: { children?: React.ReactNode }) {
  return (
    <main className="relative h-[calc(100dvh-4rem)] bg-black text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold drop-shadow">Reels</h1>
        <Link href="/create" aria-label="New reel" className="pointer-events-auto p-1 drop-shadow">
          <CreateIcon />
        </Link>
      </header>
      {children ?? (
        <div className="flex h-full items-center justify-center">
          <Spinner light />
        </div>
      )}
    </main>
  );
}

function Reels() {
  // /reels?id=<post id> starts with that reel (from a profile grid or a shared link).
  const startId = useSearchParams().get("id");
  const { posts, hasMore, loading, error, loadMore, sentinelRef } = useInfinitePosts(PAGE_SIZE, "videos");
  const [start, setStart] = useState<Post | null | undefined>(startId ? undefined : null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reels = useMemo(
    () => (start ? [start, ...posts.filter((p) => p.id !== start.id)] : posts),
    [start, posts],
  );
  // Stable across renders so the memoized reels don't re-render when a new page arrives.
  // Fetches the next page while there are still a few reels left to watch.
  const latest = useRef({ count: 0, hasMore, loadMore });
  useEffect(() => {
    latest.current = { count: reels.length, hasMore, loadMore };
  });
  const onReelActive = useCallback((i: number) => {
    const { count, hasMore, loadMore } = latest.current;
    if (i >= count - 3 && hasMore) loadMore();
  }, []);
  const soundOn = useSoundOn();
  const soundRef = useRef(soundOn);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (!startId) return setStart(null);
    let live = true;
    api
      .getPost(startId)
      .then((p) => live && setStart(p?.mediaType === "video" ? p : null))
      .catch(() => live && setStart(null));
    return () => {
      live = false;
    };
  }, [startId]);

  // Reels play with sound, like Instagram. If the browser blocks that, the player mutes again.
  useEffect(() => setSoundOn(true), []);

  // Desktop: arrow keys / j k move between reels, m toggles sound.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = scrollerRef.current;
      if (!el || (e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowDown" || e.key === "j") el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
      else if (e.key === "ArrowUp" || e.key === "k") el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
      else if (e.key === "m") setSoundOn(!soundRef.current);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (start === undefined) return <ReelsFrame />;

  // Nothing to show yet: keep the loading/empty state out of the snap list. Otherwise the
  // browser keeps that panel snapped into view as reels are inserted above it, which
  // jumps straight past every reel.
  if (reels.length === 0) {
    return (
      <ReelsFrame>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <div ref={sentinelRef} aria-hidden className="h-px w-px" />
          {error ? (
            <>
              <p className="text-white/80">{error}</p>
              <button type="button" onClick={loadMore} className="font-semibold text-sky-400">
                Try again
              </button>
            </>
          ) : loading || hasMore ? (
            <Spinner light />
          ) : (
            <>
              <ReelsIcon className="h-12 w-12" />
              <p className="text-lg font-semibold">No reels yet</p>
              <Link href="/create" className="text-sm font-semibold text-sky-400">
                Share a video
              </Link>
            </>
          )}
        </div>
      </ReelsFrame>
    );
  }

  return (
    <ReelsFrame>
      <div ref={scrollerRef} className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
        {reels.map((post, i) => (
          <ReelPlayer key={post.id} post={post} index={i} onActive={onReelActive} />
        ))}

        <section className="flex h-full snap-start flex-col items-center justify-center gap-3 px-8 text-center">
          {/* Backup for reaching the end before the next page arrived. */}
          <div ref={sentinelRef} aria-hidden className="h-px w-px" />
          {error ? (
            <>
              <p className="text-white/80">{error}</p>
              <button type="button" onClick={loadMore} className="font-semibold text-sky-400">
                Try again
              </button>
            </>
          ) : loading || hasMore ? (
            <Spinner light />
          ) : (
            <>
              <p className="text-4xl" aria-hidden>
                ✨
              </p>
              <p className="text-lg font-semibold">You&apos;re all caught up</p>
              <p className="text-sm text-white/70">You&apos;ve watched every reel on Mova.</p>
              <button
                type="button"
                onClick={() => scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                className="mt-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold"
              >
                Back to the first reel
              </button>
            </>
          )}
        </section>
      </div>
    </ReelsFrame>
  );
}
