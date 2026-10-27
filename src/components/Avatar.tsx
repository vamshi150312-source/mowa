"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Profile } from "@/lib/types";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  story: "h-16 w-16 text-xl",
  lg: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  user,
  size = "sm",
  ring = false,
}: {
  user: Pick<Profile, "username" | "avatarUrl">;
  size?: keyof typeof SIZES;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = user.avatarUrl && !failed;

  const inner = showImage ? (
    <img
      src={user.avatarUrl}
      alt={`${user.username}'s avatar`}
      className={`${SIZES[size]} rounded-full object-cover bg-neutral-200`}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={`${SIZES[size]} inline-flex items-center justify-center rounded-full bg-neutral-200 font-semibold uppercase text-neutral-600`}
      aria-label={`${user.username}'s avatar`}
    >
      {user.username.slice(0, 1)}
    </span>
  );

  if (!ring) return inner;
  return (
    <span className="inline-flex rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
      <span className="inline-flex rounded-full bg-white p-[2px]">{inner}</span>
    </span>
  );
}
