"use client";

import Link from "next/link";
import { memo, useCallback, useRef, useState } from "react";
import { useCalls } from "@/context/CallContext";
import { callLabel } from "@/lib/chat";
import { filterCss, REACTION_NAMES, type Reaction } from "@/lib/postOptions";
import type { Message, Post, Profile } from "@/lib/types";
import { useLongPress } from "@/lib/useReactions";
import { Avatar } from "./Avatar";
import { PhoneIcon, VideoCallIcon } from "./icons";
import { ReactionPicker } from "./ReactionPicker";
import { SafeImage } from "./SafeImage";

const DOUBLE_TAP_MS = 300;

/**
 * One chat bubble. Their messages: double-tap to ❤️, press and hold (or right-click) for
 * more reactions. Your messages: press and hold to copy or unsend.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  mine,
  other,
  showAvatar,
  onReact,
  onUnsend,
}: {
  message: Message;
  mine: boolean;
  other: Profile;
  /** Show their avatar next to this bubble (the last one in a run of their messages). */
  showAvatar: boolean;
  onReact: (id: string, reaction: Reaction | null) => void;
  onUnsend: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTap = useRef(0);
  const longPress = useLongPress(() => setMenuOpen(true));
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  function handleClick() {
    if (longPress.wasLongPress() || mine) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onReact(message.id, message.reaction ? null : "❤️");
    } else lastTap.current = now;
  }

  // One to three emoji on their own are shown big, without a bubble.
  const emojiOnly =
    !message.post && /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*){1,3}$/u.test(message.body);

  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""} ${message.reaction ? "mb-3" : ""}`}>
      {!mine && <span className="w-7 shrink-0">{showAvatar && <Avatar user={other} size="xs" />}</span>}
      <div className={`relative flex max-w-[75%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
        {menuOpen &&
          (mine ? (
            <OwnMessageMenu
              message={message}
              onClose={closeMenu}
              onUnsend={() => {
                setMenuOpen(false);
                onUnsend(message.id);
              }}
            />
          ) : (
            <ReactionPicker
              selected={message.reaction}
              onClose={closeMenu}
              onPick={(r) => {
                setMenuOpen(false);
                onReact(message.id, r === message.reaction ? null : r);
              }}
            />
          ))}
        <div
          onClick={handleClick}
          {...longPress.handlers}
          className="flex cursor-default select-none flex-col gap-1 [-webkit-touch-callout:none]"
          title={mine ? "Hold to copy or unsend" : "Double-tap to like · hold for more reactions"}
        >
          {message.call && <CallBubble message={message} mine={mine} other={other} />}
          {message.post && <SharedPost post={message.post} />}
          {message.postUnavailable && (
            <p className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-500">Post unavailable</p>
          )}
          {message.body &&
            (emojiOnly ? (
              <p className="text-4xl leading-tight">{message.body}</p>
            ) : (
              <p
                className={`whitespace-pre-wrap break-words rounded-3xl px-3.5 py-2 text-[15px] leading-snug ${
                  mine ? "bg-gradient-to-br from-violet-600 to-pink-500 text-white" : "bg-neutral-100 text-neutral-900"
                }`}
              >
                {message.body}
              </p>
            ))}
        </div>
        {message.reaction && (
          <span
            key={message.reaction}
            className={`animate-heart-pop absolute -bottom-3.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-white bg-neutral-100 px-1 text-sm shadow-sm ${
              mine ? "right-2" : "left-2"
            }`}
            aria-label={`${mine ? `${other.username} reacted` : "You reacted"} ${REACTION_NAMES[message.reaction]}`}
          >
            {message.reaction}
          </span>
        )}
      </div>
    </div>
  );
});

function OwnMessageMenu({ message, onClose, onUnsend }: { message: Message; onClose: () => void; onUnsend: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="menu"
        className="animate-picker-in absolute bottom-full right-0 z-40 mb-1 flex origin-bottom-right overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm font-semibold shadow-lg"
      >
        {message.body && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              navigator.clipboard?.writeText(message.body).catch(() => {});
              onClose();
            }}
            className="px-4 py-2 hover:bg-neutral-50"
          >
            Copy
          </button>
        )}
        <button type="button" role="menuitem" onClick={onUnsend} className="px-4 py-2 text-red-500 hover:bg-neutral-50">
          Unsend
        </button>
      </div>
    </>
  );
}

/** The record of a call, with a button to call back. */
function CallBubble({ message, mine, other }: { message: Message; mine: boolean; other: Profile }) {
  const { startCall } = useCalls();
  const call = message.call!;
  const missed = call.outcome !== "completed" && !mine;
  const Icon = call.kind === "video" ? VideoCallIcon : PhoneIcon;
  return (
    <span className="flex items-center gap-3 rounded-2xl bg-neutral-100 py-2 pl-3 pr-2 text-neutral-900">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${missed ? "bg-red-100 text-red-600" : "bg-white"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold">{callLabel(call, mine)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          startCall(other, call.kind);
        }}
        className="ml-1 shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50"
      >
        {mine ? "Call again" : "Call back"}
      </button>
    </span>
  );
}

/** A post shared into a chat: author, media and caption. Opens the post. */
function SharedPost({ post }: { post: Post }) {
  return (
    <Link
      href={`/p/${post.id}`}
      onClick={(e) => e.stopPropagation()}
      className="block w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900"
    >
      <span className="flex items-center gap-2 px-3 py-2">
        <Avatar user={post.author} size="xs" />
        <span className="truncate text-sm font-semibold">{post.author.username}</span>
      </span>
      <span className="block aspect-square overflow-hidden bg-neutral-100" style={{ filter: filterCss(post.filter) }}>
        {post.mediaType === "video" ? (
          <video src={post.imageUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <SafeImage src={post.imageUrl} alt={post.caption || `Post by ${post.author.username}`} className="h-full w-full object-cover" />
        )}
      </span>
      {post.caption && (
        <span className="line-clamp-2 px-3 py-2 text-sm">
          <span className="mr-1 font-semibold">{post.author.username}</span>
          {post.caption}
        </span>
      )}
    </Link>
  );
}

/** "…" bubble while the other person is typing. */
export function TypingBubble({ other }: { other: Profile }) {
  return (
    <div className="flex items-end gap-2" aria-label={`${other.username} is typing`}>
      <span className="w-7 shrink-0">
        <Avatar user={other} size="xs" />
      </span>
      <span className="flex gap-1 rounded-3xl bg-neutral-100 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="animate-typing-dot h-2 w-2 rounded-full bg-neutral-500" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}
