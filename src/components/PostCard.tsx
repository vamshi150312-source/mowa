"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { compactNumber, formatDateTime, timeAgo } from "@/lib/format";
import { useMindful } from "@/lib/mindful";
import { getTrack } from "@/lib/music";
import { filterCss, isScheduled, REACTION_NAMES, type Reaction } from "@/lib/postOptions";
import { setSoundOn, useSoundOn } from "@/lib/sound";
import type { Post } from "@/lib/types";
import { useLongPress, usePostReactions } from "@/lib/useReactions";
import { Avatar } from "./Avatar";
import { ClockIcon, CommentIcon, MusicIcon, HeartIcon, ReactIcon, ShareIcon, SoundOffIcon, SoundOnIcon } from "./icons";
import { PollView } from "./PollView";
import { PostVideo } from "./PostVideo";
import { ReactionPicker } from "./ReactionPicker";
import { SafeImage } from "./SafeImage";
import { SendToSheet } from "./SendToSheet";

const DOUBLE_TAP_MS = 300;

/**
 * One feed post. Memoized: liking a post, or the feed loading another page, re-renders only
 * the cards whose props changed.
 */
export const PostCard = memo(function PostCard({ post, showCommentLink = true }: { post: Post; showCommentLink?: boolean }) {
  const hideCounts = useMindful((s) => s.hideCounts);
  const { myReaction, total, topReactions, popKey, react: applyReaction } = usePostReactions(post);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Bumping the key remounts the burst, which replays its CSS animation.
  const [burst, setBurst] = useState<{ key: number; reaction: Reaction } | null>(null);
  const [sharing, setSharing] = useState(false);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const soundOn = useSoundOn();
  const isVideo = post.mediaType === "video";
  const scheduled = isScheduled(post);
  const track = isVideo ? getTrack(post.music) : null;
  // Press and hold the heart to choose a different reaction.
  const longPress = useLongPress(() => setPickerOpen(true));

  useEffect(() => () => clearTimeout(singleTapTimer.current), []);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeShare = useCallback(() => setSharing(false), []);

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      clearTimeout(singleTapTimer.current);
      // Double-tap only ever adds a reaction, like the native app; it keeps one you already picked.
      setBurst({ key: now, reaction: myReaction ?? "❤️" });
      if (!myReaction) applyReaction("❤️");
    } else {
      lastTap.current = now;
      // On videos a single tap toggles sound; wait to make sure it isn't a double-tap.
      if (isVideo) singleTapTimer.current = setTimeout(() => setSoundOn(!soundOn), DOUBLE_TAP_MS);
    }
  }

  return (
    <article className="border-b border-neutral-100 pb-3">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-3">
          <Avatar user={post.author} size="sm" ring />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{post.author.username}</span>
            {track && (
              <span className="flex items-center gap-1 truncate text-xs text-neutral-500">
                <MusicIcon className="h-3 w-3 shrink-0" /> {track.title} · {track.artist}
              </span>
            )}
          </span>
        </Link>
        {scheduled ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <ClockIcon className="h-3.5 w-3.5" /> Goes live {formatDateTime(post.createdAt)}
          </span>
        ) : (
          <span className="text-sm text-neutral-400">• {timeAgo(post.createdAt)}</span>
        )}
      </header>

      <div
        className={`relative w-full cursor-pointer select-none overflow-hidden bg-neutral-100 ${isVideo ? "aspect-[4/5]" : "aspect-square"}`}
        onClick={handleMediaTap}
      >
        {/* The filter wraps only the media, so overlays keep their true colours. */}
        <div className="absolute inset-0" style={{ filter: filterCss(post.filter) }}>
          {isVideo ? (
            <PostVideo
              src={post.imageUrl}
              soundOn={soundOn}
              music={post.music}
              label={post.caption || `Video by ${post.author.username}`}
            />
          ) : (
            <SafeImage
              src={post.imageUrl}
              alt={post.caption || `Photo by ${post.author.username}`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        {isVideo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSoundOn(!soundOn);
            }}
            aria-label={soundOn ? "Mute" : "Unmute"}
            className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 p-1.5 text-white"
          >
            {soundOn ? <SoundOnIcon className="h-3.5 w-3.5" /> : <SoundOffIcon className="h-3.5 w-3.5" />}
          </button>
        )}
        {burst && (
          <div key={burst.key} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {burst.reaction === "❤️" ? (
              <HeartIcon filled className="animate-heart-burst h-28 w-28 text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]" />
            ) : (
              <span className="animate-heart-burst text-[96px] leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
                {burst.reaction}
              </span>
            )}
          </div>
        )}
      </div>

      {sharing && <SendToSheet post={post} onClose={closeShare} />}
      {post.poll && <PollView postId={post.id} poll={post.poll} hideCounts={hideCounts} />}

      <div className="relative flex items-center gap-1 px-1.5 pt-1.5">
        {pickerOpen && (
          <ReactionPicker
            selected={myReaction}
            onClose={closePicker}
            onPick={(r) => {
              setPickerOpen(false);
              applyReaction(r === myReaction ? null : r);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (longPress.wasLongPress()) return;
            applyReaction(myReaction ? null : "❤️");
          }}
          {...longPress.handlers}
          aria-label={myReaction ? `Remove your reaction (${REACTION_NAMES[myReaction]})` : "Like"}
          aria-pressed={!!myReaction}
          title="Tap to like · hold for more reactions"
          className="p-1.5 transition-transform [-webkit-touch-callout:none] active:scale-90"
        >
          {myReaction && myReaction !== "❤️" ? (
            <span key={popKey} className="animate-heart-pop block h-7 w-7 text-center text-[24px] leading-7">
              {myReaction}
            </span>
          ) : (
            <HeartIcon
              key={popKey}
              filled={!!myReaction}
              className={`h-7 w-7 transition-colors duration-200 ${myReaction ? "animate-heart-pop text-red-500" : "text-neutral-900 hover:text-neutral-500"}`}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label="Choose a reaction"
          aria-expanded={pickerOpen}
          className="p-1.5 hover:text-neutral-500"
        >
          <ReactIcon className="h-[26px] w-[26px]" />
        </button>
        <Link href={`/p/${post.id}`} aria-label="Comment" className="p-1.5 hover:text-neutral-500">
          <CommentIcon className="h-7 w-7 -scale-x-100" />
        </Link>
        <button type="button" onClick={() => setSharing(true)} aria-label="Share" className="p-1.5 hover:text-neutral-500">
          <ShareIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="space-y-1 px-3 text-sm">
        {total > 0 ? (
          <p className="flex items-center gap-2 font-semibold">
            <span className="flex -space-x-1" aria-hidden>
              {topReactions.map((r) => (
                <span key={r} className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm ring-2 ring-white">
                  {r}
                </span>
              ))}
            </span>
            {hideCounts
              ? myReaction
                ? "You reacted"
                : "Reactions"
              : `${compactNumber(total)} ${total === 1 ? "reaction" : "reactions"}`}
          </p>
        ) : (
          <p className="text-neutral-500">Be the first to react</p>
        )}
        {post.caption && (
          <p className="whitespace-pre-line break-words">
            <Link href={`/u/${post.author.username}`} className="mr-1.5 font-semibold">
              {post.author.username}
            </Link>
            {post.caption}
          </p>
        )}
        {showCommentLink && (
          <Link href={`/p/${post.id}`} className="block text-neutral-500">
            {post.commentCount === 0
              ? "Add a comment…"
              : hideCounts
                ? "View comments"
                : `View ${post.commentCount === 1 ? "1 comment" : `all ${post.commentCount} comments`}`}
          </Link>
        )}
      </div>
    </article>
  );
});

export function PostCardSkeleton() {
  return (
    <div className="animate-pulse pb-6">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="h-8 w-8 rounded-full bg-neutral-200" />
        <div className="h-3 w-28 rounded bg-neutral-200" />
      </div>
      <div className="aspect-square w-full bg-neutral-200" />
      <div className="space-y-2 px-3 pt-3">
        <div className="h-3 w-16 rounded bg-neutral-200" />
        <div className="h-3 w-3/4 rounded bg-neutral-200" />
      </div>
    </div>
  );
}
