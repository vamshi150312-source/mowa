"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SearchIcon } from "@/components/icons";
import { PostGrid, PostGridSkeleton } from "@/components/PostGrid";
import { Spinner } from "@/components/Spinner";
import { SuggestedUsers } from "@/components/SuggestedUsers";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { useInfinitePosts } from "@/lib/useInfinitePosts";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced user search across everyone on the app.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const timer = setTimeout(() => {
      api
        .searchUsers(q)
        .then((users) => active && setResults(users))
        .catch(() => active && setResults([]))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <main>
      <div className="sticky top-0 z-20 bg-white px-3 py-2">
        <label className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2">
          <SearchIcon className="h-4 w-4 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search users"
            autoCapitalize="none"
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      {query.trim() ? (
        <ul className="py-1">
          {searching && !results && (
            <li className="flex justify-center py-6">
              <Spinner />
            </li>
          )}
          {results?.length === 0 && !searching && (
            <li className="py-10 text-center text-sm text-neutral-500">No accounts found for “{query.trim()}”.</li>
          )}
          {results?.map((u) => (
            <li key={u.id}>
              <Link href={`/u/${u.username}`} className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50">
                <Avatar user={u} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.username}</p>
                  <p className="truncate text-sm text-neutral-500">{u.fullName}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <SuggestedUsers />
          <Explore />
        </>
      )}
    </main>
  );
}

/** Endless grid of everyone's posts, loaded 21 at a time (seven full rows). */
function Explore() {
  const { posts, hasMore, loading, error, loadMore, sentinelRef } = useInfinitePosts(21, "explore");

  return (
    <section aria-label="Explore">
      {posts.length > 0 ? <PostGrid posts={posts} /> : !error && <PostGridSkeleton count={12} />}
      {loading && posts.length > 0 && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {error && (
        <div className="py-8 text-center text-sm">
          <p className="text-neutral-600">{error}</p>
          <button onClick={loadMore} className="mt-2 font-semibold text-sky-500">
            Try again
          </button>
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="py-8 text-center text-sm text-neutral-400">You&apos;ve seen everything ✨</p>
      )}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </section>
  );
}
