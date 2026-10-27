"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { compactNumber } from "@/lib/format";
import { useMindful } from "@/lib/mindful";
import { filterCss, isScheduled, REACTION_NAMES, type Reaction } from "@/lib/postOptions";
import { setSoundOn, useSoundOn } from "@/lib/sound";
import type { Post } from "@/lib/types";
import { getTrack } from "@/lib/music";
import { useLongPress, usePostReactions } from "@/lib/useReactions";
import { useSoundtrack } from "@/lib/useSoundtrack";
import { Avatar } from "./Avatar";
import { CommentsSheet } from "./CommentsSheet";
import { ClockIcon, CommentIcon, HeartIcon, MusicIcon, PollIcon, ReactIcon, ShareIcon, SoundOffIcon, SoundOnIcon } from "./icons";
import { ReactionPicker } from "./ReactionPicker";
import { SendToSheet } from "./SendToSheet";
import { Spinner } from "./Spinner";

const DOUBLE_TAP_MS = 300;
const HOLD_TO_PAUSE_MS = 220;

/**
 * One full-screen reel. Plays while at least 60% visible.
 * Tap: sound on/off · double-tap: react · press and hold: pause.
 */
export const ReelPlayer = memo(function ReelPlayer({
  post,
  index,
  onActive,
}: {
  post: Post;
  index: number;
  /** Called with `index` when this reel becomes the one on screen. Keep it stable (useCallback). */
  onActive: (index: number) => void;
}) {
  const { user: me } = useAuth();
  const hideCounts = useMindful((s) => s.hideCounts);
  const soundOn = useSoundOn();
  const { myReaction, total, popKey, react } = usePostReactions(post);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [holding, setHolding] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState<{ key: number; reaction: Reaction } | null>(null);
  const [soundFlash, setSoundFlash] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [expanded, setExpanded] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);
  const longPress = useLongPress(() => setPickerOpen(true));
  const isMe = me?.id === post.author.id;
  const track = getTrack(post.music);
  const onActiveRef = useRef(onActive);
  useEffect(() => {
    onActiveRef.current = onActive;
  });

  useEffect(
    () => () => {
      clearTimeout(tapTimer.current);
      clearTimeout(holdTimer.current);
    },
    [],
  );

  // Active = at least 60% on screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6],
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (active) onActiveRef.current(index);
    // Only when this reel becomes active; `index` is fixed for a mounted reel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // React doesn't reliably sync the `muted` attribute, so set the property directly.
  useEffect(() => {
    // With music, the soundtrack replaces the video's own sound.
    if (videoRef.current) videoRef.current.muted = post.music ? true : !soundOn;
  }, [soundOn, post.music]);

  // `active` flipping restarts the track, like the video.
  useSoundtrack(post.music, active && !holding, soundOn, active);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      video.currentTime = 0; // like Instagram, a reel starts over when you come back to it
      return;
    }
    video.play().catch(() => {
      // Browsers block autoplay with sound until the user has interacted with the page.
      setSoundOn(false);
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [active]);

  // Find out whether I follow the author once the reel is on screen.
  useEffect(() => {
    if (!active || isMe || following !== null) return;
    let live = true;
    api.isFollowing(post.author.id).then((f) => live && setFollowing(f), () => {});
    return () => {
      live = false;
    };
  }, [active, isMe, following, post.author.id]);

  function onPointerDown() {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setHolding(true);
      videoRef.current?.pause();
    }, HOLD_TO_PAUSE_MS);
  }

  function onPointerUp(e: PointerEvent) {
    clearTimeout(holdTimer.current);
    if (!held.current) return;
    e.preventDefault();
    setHolding(false);
    if (active) videoRef.current?.play().catch(() => {});
  }

  function onTap() {
    if (held.current) {
      held.current = false; // the end of a press-and-hold, not a tap
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      clearTimeout(tapTimer.current);
      setBurst({ key: now, reaction: myReaction ?? "❤️" });
      if (!myReaction) react("❤️");
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        setSoundOn(!soundOn);
        setSoundFlash(Date.now());
      }, DOUBLE_TAP_MS);
    }
  }

  async function follow() {
    setFollowing(true);
    try {
      await api.setFollow(post.author.id, true);
    } catch {
      setFollowing(false);
    }
  }

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeComments = useCallback(() => setCommentsOpen(false), []);
  const closeShare = useCallback(() => setSharing(false), []);
  const chrome = `transition-opacity duration-200 ${holding ? "opacity-0" : "opacity-100"}`;

  return (
    <section
      ref={sectionRef}
      aria-label={`Reel by ${post.author.username}`}
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black text-white"
    >
      <div
        className="absolute inset-0 select-none [-webkit-touch-callout:none]"
        style={{ filter: filterCss(post.filter) }}
        onClick={onTap}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          src={post.imageUrl}
          aria-label={post.caption || `Reel by ${post.author.username}`}
          muted
          loop
          playsInline
          preload={active ? "auto" : "metadata"}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProgress(v.currentTime / v.duration);
          }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          className="h-full w-full object-cover"
        />
      </div>

      {buffering && active && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner light />
        </div>
      )}

      {soundFlash > 0 && (
        <div key={soundFlash} className="animate-flash pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/60 p-4">
            {soundOn ? <SoundOnIcon className="h-7 w-7" /> : <SoundOffIcon className="h-7 w-7" />}
          </span>
        </div>
      )}

      {burst && (
        <div key={burst.key} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {burst.reaction === "❤️" ? (
            <HeartIcon filled className="animate-heart-burst h-28 w-28 text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]" />
          ) : (
            <span className="animate-heart-burst text-[96px] leading-none">{burst.reaction}</span>
          )}
        </div>
      )}

      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent ${chrome}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent ${chrome}`} />

      {isScheduled(post) && (
        <span className="absolute left-1/2 top-14 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold">
          <ClockIcon className="h-3.5 w-3.5" /> Scheduled
        </span>
      )}

      {/* Side rail */}
      <div className={`absolute bottom-6 right-2 flex w-14 flex-col items-center gap-4 text-xs font-semibold drop-shadow ${chrome}`}>
        <div className="relative flex flex-col items-center">
          {pickerOpen && (
            <ReactionPicker
              placement="left"
              selected={myReaction}
              onClose={closePicker}
              onPick={(r) => {
                setPickerOpen(false);
                react(r === myReaction ? null : r);
              }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (longPress.wasLongPress()) return;
              react(myReaction ? null : "❤️");
            }}
            {...longPress.handlers}
            aria-label={myReaction ? `Remove your reaction (${REACTION_NAMES[myReaction]})` : "Like"}
            aria-pressed={!!myReaction}
            title="Tap to like · hold for more reactions"
            className="p-1 transition-transform [-webkit-touch-callout:none] active:scale-90"
          >
            {myReaction && myReaction !== "❤️" ? (
              <span key={popKey} className="animate-heart-pop block h-8 w-8 text-center text-[28px] leading-8">
                {myReaction}
              </span>
            ) : (
              <HeartIcon
                key={popKey}
                filled={!!myReaction}
                className={`h-8 w-8 ${myReaction ? "animate-heart-pop text-red-500" : ""}`}
              />
            )}
          </button>
          {!hideCounts && <span>{compactNumber(total)}</span>}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Choose a reaction"
          aria-expanded={pickerOpen}
          className="p-1"
        >
          <ReactIcon className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label="Comments"
          className="flex flex-col items-center"
        >
          <CommentIcon className="h-8 w-8 -scale-x-100 p-0.5" />
          {!hideCounts && <span>{compactNumber(commentCount)}</span>}
        </button>
        <button type="button" onClick={() => setSharing(true)} aria-label="Share" className="flex flex-col items-center">
          <ShareIcon className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? "Mute" : "Unmute"}
          className="rounded-full bg-white/15 p-2"
        >
          {soundOn ? <SoundOnIcon className="h-4 w-4" /> : <SoundOffIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* Author, caption, audio */}
      <div className={`absolute bottom-5 left-3 right-20 space-y-2.5 text-sm ${chrome}`}>
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-full ring-1 ring-white/70">
              <Avatar user={post.author} size="sm" />
            </span>
            <span className="truncate font-semibold drop-shadow">{post.author.username}</span>
          </Link>
          {!isMe && following === false && (
            <button
              type="button"
              onClick={follow}
              className="shrink-0 rounded-lg border border-white/80 px-3 py-0.5 text-xs font-semibold hover:bg-white/10"
            >
              Follow
            </button>
          )}
        </div>
        {post.caption && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`block w-full whitespace-pre-line break-words text-left drop-shadow ${expanded ? "max-h-40 overflow-y-auto" : "line-clamp-2"}`}
          >
            {post.caption}
          </button>
        )}
        {post.poll && (
          <Link
            href={`/p/${post.id}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur"
          >
            <PollIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Poll: {post.poll.question}</span>
          </Link>
        )}
        <p className="flex items-center gap-1.5 text-xs text-white/90">
          <MusicIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{track ? `${track.title} · ${track.artist}` : `Original audio · ${post.author.username}`}</span>
        </p>
      </div>

      {/* Browsers start muted until you tap; make that obvious. */}
      {active && !soundOn && !holding && (
        <button
          type="button"
          onClick={() => {
            setSoundOn(true);
            setSoundFlash(Date.now());
          }}
          className="absolute left-1/2 top-14 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur"
        >
          <SoundOffIcon className="h-3.5 w-3.5" /> Tap for sound
        </button>
      )}

      {/* Progress */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25" aria-hidden>
        <div className="h-full bg-white transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>

      {commentsOpen && (
        <CommentsSheet
          postId={post.id}
          authorUsername={post.author.username}
          onClose={closeComments}
          onCountChange={setCommentCount}
        />
      )}
      {sharing && <SendToSheet post={post} path={`/reels?id=${post.id}`} onClose={closeShare} />}
    </section>
  );
});
