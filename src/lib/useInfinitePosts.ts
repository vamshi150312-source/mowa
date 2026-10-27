"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { FeedKind, Post } from "./types";

/**
 * Cursor-paginated posts that load the next page when `sentinelRef`'s element
 * scrolls near the viewport. Used by the home feed, the explore grid and Reels.
 */
export function useInfinitePosts(pageSize: number, kind: FeedKind = "all") {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await api.getFeed(cursor, pageSize, kind);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load posts.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore, pageSize, kind]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || error) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: "600px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, error]);

  return { posts, hasMore, loading, error, loadMore, sentinelRef };
}
