"use client";

import Link from "next/link";
import { compactNumber } from "@/lib/format";
import { useMindful } from "@/lib/mindful";
import { filterCss, isScheduled } from "@/lib/postOptions";
import type { Post } from "@/lib/types";
import { ClockIcon, CommentIcon, HeartIcon, PollIcon, ReelsIcon } from "./icons";
import { SafeImage } from "./SafeImage";

/** Videos open in Reels; photos open their post page. */
const postHref = (post: Post) => (post.mediaType === "video" ? `/reels?id=${post.id}` : `/p/${post.id}`);

/**
 * 3-column grid, like the native profile / explore layout. `tall` uses 9:16 tiles, for a
 * profile's Reels tab.
 */
export function PostGrid({ posts, tall = false }: { posts: Post[]; tall?: boolean }) {
  const hideCounts = useMindful((s) => s.hideCounts);
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {posts.map((post) => {
        const reactionCount = Object.values(post.reactions).reduce((sum, n) => sum + (n ?? 0), 0);
        const scheduled = isScheduled(post);
        return (
          <Link
            key={post.id}
            href={postHref(post)}
            className={`group relative overflow-hidden bg-neutral-100 ${tall ? "aspect-[9/16]" : "aspect-square"}`}
          >
            <div className={`h-full w-full ${scheduled ? "opacity-60" : ""}`} style={{ filter: filterCss(post.filter) }}>
              {post.mediaType === "video" ? (
                // "#t=0.1" makes the browser show an early frame as the thumbnail.
                <video
                  src={`${post.imageUrl}#t=0.1`}
                  aria-label={post.caption || "Video"}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <SafeImage src={post.imageUrl} alt={post.caption || "Post"} className="h-full w-full object-cover" />
              )}
            </div>
            <span className="absolute right-2 top-2 flex gap-1 text-white drop-shadow">
              {post.poll && <PollIcon className="h-5 w-5" />}
              {post.mediaType === "video" && !tall && <ReelsIcon className="h-5 w-5" />}
            </span>
            {scheduled && (
              <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-black/70 py-0.5 text-[11px] font-semibold text-white">
                <ClockIcon className="h-3 w-3" /> Scheduled
              </span>
            )}
            {tall && !scheduled && !hideCounts && (
              <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold text-white drop-shadow">
                <HeartIcon filled className="h-3.5 w-3.5" /> {compactNumber(reactionCount)}
              </span>
            )}
            {!hideCounts && (
              <div className="absolute inset-0 hidden items-center justify-center gap-4 bg-black/30 text-sm font-semibold text-white group-hover:flex">
                <span className="flex items-center gap-1">
                  <HeartIcon filled className="h-5 w-5" /> {compactNumber(reactionCount)}
                </span>
                <span className="flex items-center gap-1">
                  <CommentIcon className="h-5 w-5 -scale-x-100" fill="currentColor" /> {compactNumber(post.commentCount)}
                </span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function PostGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid animate-pulse grid-cols-3 gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-square bg-neutral-200" />
      ))}
    </div>
  );
}
