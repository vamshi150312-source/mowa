"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { CommentItem } from "@/components/CommentItem";
import { PageHeader } from "@/components/PageHeader";
import { PostCard, PostCardSkeleton } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Comment, Post } from "@/lib/types";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(() => {
    api.getComments(id).then(setComments).catch(() => {});
  }, [id]);

  useEffect(() => {
    api.getPost(id).then(setPost).catch(() => setPost(null));
    loadComments();
    // Realtime: refresh comments when someone else adds one.
    return api.subscribeToPost(id, loadComments);
  }, [id, loadComments]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await api.addComment(id, body);
      setComments((c) => (c.some((x) => x.id === comment.id) ? c : [...c, comment]));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="pb-16">
      <PageHeader title="Post" back />

      {post === undefined && <PostCardSkeleton />}
      {post === null && (
        <div className="px-6 py-20 text-center">
          <p className="text-lg font-semibold">This post isn&apos;t available.</p>
          <Link href="/" className="mt-2 inline-block text-sm text-sky-500">
            Back to feed
          </Link>
        </div>
      )}

      {post && (
        <>
          <PostCard post={post} showCommentLink={false} />
          <section aria-label="Comments" className="px-3 py-2">
            {comments.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">No comments yet. Start the conversation.</p>
            ) : (
              <ul className="space-y-4 py-2">
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
              </ul>
            )}
          </section>

          <form
            onSubmit={submit}
            className="fixed inset-x-0 bottom-14 z-20 mx-auto flex max-w-md items-center gap-3 border-t border-neutral-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {user && <Avatar user={user} size="sm" />}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2200}
              placeholder={`Add a comment for ${post.author.username}…`}
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
          {error && <p className="px-3 text-sm text-red-500">{error}</p>}
        </>
      )}
    </main>
  );
}
