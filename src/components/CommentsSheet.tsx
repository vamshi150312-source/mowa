"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CommentItem } from "./CommentItem";
import { CloseIcon } from "./icons";
import { Spinner } from "./Spinner";

/** Bottom sheet with a post's comments, used over Reels so the video keeps its place. */
export function CommentsSheet({
  postId,
  authorUsername,
  onClose,
  onCountChange,
}: {
  postId: string;
  authorUsername: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getComments(postId)
      .then((c) => {
        setComments(c);
        onCountChange(c.length);
      })
      .catch(() => setComments((c) => c ?? []));
  }, [postId, onCountChange]);

  useEffect(() => {
    load();
    return api.subscribeToPost(postId, load);
  }, [postId, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await api.addComment(postId, body);
      const next = comments?.some((x) => x.id === comment.id) ? comments : [...(comments ?? []), comment];
      setComments(next);
      onCountChange(next.length);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Comments">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="animate-sheet-up relative flex h-[70dvh] w-full max-w-md flex-col rounded-t-2xl bg-white text-neutral-900">
        <div className="relative flex items-center justify-center border-b border-neutral-100 py-3">
          <span className="absolute top-1.5 h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
          <h2 className="pt-1 text-sm font-semibold">Comments</h2>
          <button type="button" onClick={onClose} aria-label="Close comments" className="absolute right-3 top-2.5 p-1">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {comments === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-semibold">No comments yet</p>
              <p className="text-sm text-neutral-500">Start the conversation.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} />
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={submit}
          className="flex items-center gap-3 border-t border-neutral-200 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {user && <Avatar user={user} size="sm" />}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2200}
            placeholder={`Add a comment for ${authorUsername}…`}
            aria-label="Add a comment"
            className="min-w-0 flex-1 text-sm outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={!draft.trim() || posting}
            className="text-sm font-semibold text-sky-500 disabled:opacity-40"
          >
            Post
          </button>
        </form>
        {error && <p className="px-3 pb-2 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
