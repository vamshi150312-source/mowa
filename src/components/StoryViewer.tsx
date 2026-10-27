"use client";

/* eslint-disable @next/next/no-img-element -- remote story images of unknown origin */
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { filterCss, REACTION_NAMES, REACTIONS, STORY_IMAGE_SECONDS, type Reaction } from "@/lib/postOptions";
import { setSoundOn, useSoundOn } from "@/lib/sound";
import { getTrack } from "@/lib/music";
import type { StoryGroup, StoryViewer as Viewer } from "@/lib/types";
import { useSoundtrack } from "@/lib/useSoundtrack";
import { Avatar } from "./Avatar";
import { CloseIcon, MusicIcon, SoundOffIcon, SoundOnIcon } from "./icons";
import { Spinner } from "./Spinner";

const HOLD_MS = 200;
const SWIPE_CLOSE_PX = 80;

const firstUnseen = (g: StoryGroup) => Math.max(0, g.stories.findIndex((s) => !s.seen));

/**
 * Full-screen story player. Plays `groups` in order from `startGroup`, starting each
 * person at their first unseen story. Tap right/left: next/previous · hold: pause ·
 * swipe down or Esc: close.
 */
export function StoryViewer({
  groups,
  startGroup,
  onClose,
  onSeen,
  onDeleted,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onSeen: (storyId: string) => void;
  onDeleted: (storyId: string) => void;
}) {
  const { user: me } = useAuth();
  const soundOn = useSoundOn();
  const [pos, setPos] = useState(() => ({ g: startGroup, s: firstUnseen(groups[startGroup]) }));
  // Playback state is tagged with its story, so a new story always starts at 0, not loaded.
  // (Resetting it in an effect instead would let the photo timer start with the previous
  // story's finished state for one render, and skip straight through every story.)
  const [playback, setPlayback] = useState({ id: "", progress: 0, loaded: false });
  const [holding, setHolding] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [myReactions, setMyReactions] = useState<Record<string, Reaction | null>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [restarts, setRestarts] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);

  const group = groups[pos.g];
  const story = group?.stories[pos.s];
  const storyId = story?.id;
  const { progress, loaded } = playback.id === storyId ? playback : { progress: 0, loaded: false };
  const setProgress = (value: number) =>
    setPlayback((p) => ({ ...(p.id === storyId ? p : { id: storyId ?? "", loaded: false }), progress: value }));
  const setLoaded = () => setPlayback((p) => (p.id === storyId ? { ...p, loaded: true } : { id: storyId ?? "", progress: 0, loaded: true }));
  const mine = !!story && story.author.id === me?.id;
  const paused = holding || viewersOpen || confirmDelete;
  const myReaction = story ? (myReactions[story.id] ?? story.myReaction) : null;
  const track = getTrack(story?.music);

  function next() {
    if (pos.s < group.stories.length - 1) setPos({ g: pos.g, s: pos.s + 1 });
    else if (pos.g < groups.length - 1) setPos({ g: pos.g + 1, s: firstUnseen(groups[pos.g + 1]) });
    else onClose();
  }

  function prev() {
    if (pos.s > 0) setPos({ g: pos.g, s: pos.s - 1 });
    else if (pos.g > 0) setPos({ g: pos.g - 1, s: 0 });
    else {
      // Already at the very first story: start it over.
      setProgress(0);
      setRestarts((n) => n + 1);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }

  // Keep the latest handlers for timers and key listeners.
  const nav = useRef({ next, prev, onClose });
  useEffect(() => {
    nav.current = { next, prev, onClose };
  });

  // A story was removed from under us (e.g. deleted): close.
  useEffect(() => {
    if (!story) onClose();
  }, [story, onClose]);

  // New story: record the view.
  useEffect(() => {
    setViewersOpen(false);
    if (!story || mine || story.seen) return;
    onSeen(story.id);
    api.markStorySeen(story.id).catch(() => {});
    // Only when the story changes; `story.seen` flipping to true must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  // Photos: advance after a few seconds, pausing while held.
  useEffect(() => {
    if (!story || story.mediaType !== "image" || !loaded || paused) return;
    const duration = STORY_IMAGE_SECONDS * 1000;
    const start = performance.now() - progress * duration;
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p >= 1) nav.current.next();
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // `progress` is read once to resume where it paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, loaded, paused, restarts]);

  // Videos: play/pause with the viewer, sound from the app-wide setting.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || story?.mediaType !== "video") return;
    // With music, the soundtrack replaces the video's own sound.
    video.muted = story.music ? true : !soundOn;
    if (paused) return void video.pause();
    video.play().catch(() => {
      setSoundOn(false);
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [storyId, story?.mediaType, story?.music, paused, soundOn]);

  // Music (photo or video stories) plays while the story is on screen and not paused.
  useSoundtrack(story?.music ?? null, loaded && !paused, soundOn, storyId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") nav.current.onClose();
      else if (e.key === "ArrowRight") nav.current.next();
      else if (e.key === "ArrowLeft") nav.current.prev();
    };
    window.addEventListener("keydown", onKey);
    // Stories play with sound. Opening them was a tap, so the browser allows it.
    setSoundOn(true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function onPointerDown(e: PointerEvent) {
    pointer.current = { x: e.clientX, y: e.clientY };
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setHolding(true);
    }, HOLD_MS);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    clearTimeout(holdTimer.current);
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const wasHold = held.current;
    held.current = false;
    setHolding(false);
    if (e.clientY - start.y > SWIPE_CLOSE_PX) return onClose();
    if (wasHold) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  }

  async function react(reaction: Reaction) {
    if (!story) return;
    const nextReaction = reaction === myReaction ? null : reaction;
    setMyReactions((r) => ({ ...r, [story.id]: nextReaction }));
    setToast(nextReaction ? `Sent ${nextReaction}` : "Reaction removed");
    setTimeout(() => setToast(null), 1300);
    try {
      await api.reactToStory(story.id, nextReaction);
    } catch {
      setMyReactions((r) => ({ ...r, [story.id]: myReaction }));
      setToast("Couldn't send your reaction");
    }
  }

  async function remove() {
    if (!story) return;
    try {
      await api.deleteStory(story.id);
      onDeleted(story.id);
      onClose();
    } catch (e) {
      setConfirmDelete(false);
      setToast(e instanceof Error ? e.message : "Couldn't delete the story");
    }
  }

  if (!story) return null;
  const filter = filterCss(story.filter);
  const upcoming = group.stories[pos.s + 1] ?? groups[pos.g + 1]?.stories[firstUnseen(groups[pos.g + 1])];

  return (
    <div role="dialog" aria-modal="true" aria-label={`${story.author.username}'s story`} className="fixed inset-0 z-50 flex justify-center bg-black">
      <div className="relative h-full w-full max-w-[min(28rem,calc(100dvh*9/16))] overflow-hidden bg-neutral-900 text-white">
        {/* Media */}
        {story.mediaType === "image" ? (
          <>
            <img src={story.mediaUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
            <img
              key={story.id}
              src={story.mediaUrl}
              alt={story.caption || `Story by ${story.author.username}`}
              onLoad={setLoaded}
              onError={() => nav.current.next()}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ filter }}
              draggable={false}
            />
          </>
        ) : (
          <video
            key={story.id}
            ref={videoRef}
            src={story.mediaUrl}
            aria-label={story.caption || `Story by ${story.author.username}`}
            playsInline
            muted
            preload="auto"
            onLoadedData={setLoaded}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => nav.current.next()}
            onError={() => nav.current.next()}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ filter }}
          />
        )}
        {upcoming?.mediaType === "image" && <link rel="preload" as="image" href={upcoming.mediaUrl} />}
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner light />
          </div>
        )}

        {/* Tap / hold / swipe area */}
        <div
          className="absolute inset-0 select-none [-webkit-touch-callout:none]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            clearTimeout(holdTimer.current);
            pointer.current = null;
            setHolding(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        <div className={`transition-opacity duration-200 ${holding ? "opacity-0" : "opacity-100"}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />

          {/* Progress bars */}
          <div className="absolute inset-x-2 top-2 flex gap-1" aria-hidden>
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <div
                  className="h-full bg-white"
                  style={{ width: `${(i < pos.s ? 1 : i === pos.s ? progress : 0) * 100}%` }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute inset-x-0 top-5 flex items-center gap-2.5 px-3">
            <Link href={`/u/${story.author.username}`} onClick={onClose} className="flex min-w-0 items-center gap-2.5">
              <Avatar user={story.author} size="sm" />
              <span className="min-w-0 leading-tight drop-shadow">
                <span className="block truncate text-sm font-semibold">
                  {mine ? "Your story" : story.author.username}
                  <span className="ml-2 font-normal text-white/75">{timeAgo(story.createdAt)}</span>
                </span>
                {track && (
                  <span className="flex items-center gap-1 truncate text-xs text-white/85">
                    <MusicIcon className="h-3 w-3 shrink-0" /> {track.title} · {track.artist}
                  </span>
                )}
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {(story.mediaType === "video" || track) && (
                <button type="button" onClick={() => setSoundOn(!soundOn)} aria-label={soundOn ? "Mute" : "Unmute"} className="p-1.5">
                  {soundOn ? <SoundOnIcon className="h-5 w-5" /> : <SoundOffIcon className="h-5 w-5" />}
                </button>
              )}
              {mine && (
                <button type="button" onClick={() => setConfirmDelete(true)} className="px-2 py-1 text-sm font-semibold drop-shadow">
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5">
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Caption */}
          {story.caption && (
            <p className="pointer-events-none absolute inset-x-6 bottom-24 text-center">
              <span className="box-decoration-clone rounded-lg bg-black/50 px-3 py-1.5 text-[15px] font-semibold leading-8">
                {story.caption}
              </span>
            </p>
          )}

          {/* Footer: reactions for others, viewers for your own */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
            {mine ? (
              <button
                type="button"
                onClick={() => setViewersOpen(true)}
                className="mx-auto flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur"
              >
                👁 {story.viewCount ? `Seen by ${story.viewCount}` : "No views yet"}
              </button>
            ) : (
              <div className="flex justify-center gap-1.5" role="group" aria-label="React to this story">
                {REACTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => react(r)}
                    aria-label={REACTION_NAMES[r]}
                    aria-pressed={myReaction === r}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform active:scale-90 ${
                      myReaction === r ? "bg-white/30 ring-2 ring-white" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-semibold">{toast}</span>
          </div>
        )}

        {confirmDelete && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/50" onClick={() => setConfirmDelete(false)}>
            <div className="w-full rounded-t-2xl bg-white p-4 text-center text-neutral-900" onClick={(e) => e.stopPropagation()}>
              <p className="font-semibold">Delete this story?</p>
              <p className="mt-1 text-sm text-neutral-500">It will disappear for everyone right away.</p>
              <button type="button" onClick={remove} className="mt-4 w-full rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="mt-2 w-full py-2 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {viewersOpen && <ViewersSheet storyId={story.id} onClose={() => setViewersOpen(false)} />}
      </div>
    </div>
  );
}

function ViewersSheet({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStoryViewers(storyId).then(setViewers, (e) => setError(e instanceof Error ? e.message : "Couldn't load viewers."));
  }, [storyId]);

  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="animate-sheet-up flex max-h-[60%] w-full flex-col rounded-t-2xl bg-white text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-neutral-100 py-3 text-center">
          <h2 className="text-sm font-semibold">Viewers{viewers ? ` · ${viewers.length}` : ""}</h2>
          <button type="button" onClick={onClose} aria-label="Close viewers" className="absolute right-3 top-2.5 p-1">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-2">
          {error ? (
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          ) : viewers === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : viewers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No one has seen this story yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {viewers.map((v) => (
                <li key={v.user.id} className="flex items-center gap-3 py-2.5">
                  <Avatar user={v.user} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.user.username}</p>
                    <p className="text-xs text-neutral-500">{timeAgo(v.viewedAt)}</p>
                  </div>
                  {v.reaction && (
                    <span className="text-2xl" title={`Reacted ${REACTION_NAMES[v.reaction]}`}>
                      {v.reaction}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
