import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { Avatar } from "./Avatar";

export function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li className="flex gap-3">
      <Link href={`/u/${comment.author.username}`}>
        <Avatar user={comment.author} size="sm" />
      </Link>
      <div className="min-w-0 text-sm">
        <p className="break-words">
          <Link href={`/u/${comment.author.username}`} className="mr-1.5 font-semibold">
            {comment.author.username}
          </Link>
          {comment.body}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{timeAgo(comment.createdAt)}</p>
      </div>
    </li>
  );
}
