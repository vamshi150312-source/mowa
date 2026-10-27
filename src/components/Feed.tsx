"use client";

import Link from "next/link";
import { useInfinitePosts } from "@/lib/useInfinitePosts";
import { PostCard, PostCardSkeleton } from "./PostCard";
import { Spinner } from "./Spinner";

/** Infinite feed using cursor pagination: loads the next page when the sentinel scrolls into view. */
export function Feed() {
  const { posts, hasMore, loading, error, loadMore, sentinelRef } = useInfinitePosts(10);
  const initialLoad = posts.length === 0 && (loading || hasMore) && !error;

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {initialLoad && (
        <>
          <PostCardSkeleton />
          <PostCardSkeleton />
        </>
      )}

      {!initialLoad && loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="px-6 py-10 text-center text-sm">
          <p className="text-neutral-600">{error}</p>
          <button onClick={loadMore} className="mt-3 font-semibold text-sky-500">
            Try again
          </button>
        </div>
      )}

      {!hasMore && posts.length === 0 && (
        <div className="px-6 py-20 text-center">
          <p className="text-lg font-semibold">No posts yet</p>
          <Link href="/create" className="mt-2 inline-block text-sm font-semibold text-sky-500">
            Share your first photo
          </Link>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="py-8 text-center text-sm text-neutral-400">You&apos;re all caught up ✨</p>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  );
}
