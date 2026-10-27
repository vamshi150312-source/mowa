"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GridIcon, ReelsIcon, SettingsIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PostGrid, PostGridSkeleton } from "@/components/PostGrid";
import { StoryRing } from "@/components/StoryRing";
import { StoryViewer } from "@/components/StoryViewer";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { compactNumber } from "@/lib/format";
import type { Post, Profile, ProfileStats, Story } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile; posts: Post[]; stats: ProfileStats; following: boolean; stories: Story[] };

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [followBusy, setFollowBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"posts" | "reels">("posts");
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    (async () => {
      const profile = await api.getProfileByUsername(decodeURIComponent(username));
      if (!profile) return active && setState({ status: "not-found" });
      const [posts, stats, following, stories] = await Promise.all([
        api.getUserPosts(profile.id),
        api.getProfileStats(profile.id),
        api.isFollowing(profile.id),
        api.getUserStories(profile.id).catch(() => []),
      ]);
      if (active) setState({ status: "ready", profile, posts, stats, following, stories });
    })().catch((e) => active && setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
    return () => {
      active = false;
    };
  }, [username]);

  if (state.status === "loading") {
    return (
      <main>
        <PageHeader title={decodeURIComponent(username)} />
        <div className="flex animate-pulse items-center gap-6 p-4">
          <div className="h-20 w-20 rounded-full bg-neutral-200" />
          <div className="h-10 flex-1 rounded bg-neutral-200" />
        </div>
        <PostGridSkeleton />
      </main>
    );
  }

  if (state.status !== "ready") {
    return (
      <main>
        <PageHeader title="Profile" back />
        <div className="px-6 py-20 text-center">
          <p className="text-lg font-semibold">
            {state.status === "not-found" ? "Sorry, this page isn't available." : state.message}
          </p>
          <Link href="/" className="mt-2 inline-block text-sm text-sky-500">
            Go back to Mova
          </Link>
        </div>
      </main>
    );
  }

  const { profile, posts, stats, following, stories } = state;
  const reels = posts.filter((p) => p.mediaType === "video");
  const isMe = me?.id === profile.id;

  async function toggleFollow() {
    if (state.status !== "ready") return;
    const next = !following;
    // Optimistic update of button + follower count.
    setState({ ...state, following: next, stats: { ...stats, followers: stats.followers + (next ? 1 : -1) } });
    setFollowBusy(true);
    try {
      await api.setFollow(profile.id, next);
    } catch {
      setState(state);
    } finally {
      setFollowBusy(false);
    }
  }

  async function shareProfile() {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) await navigator.share({ url, title: profile.username });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <main>
      <PageHeader
        title={profile.username}
        back={!isMe}
        action={
          isMe && (
            <Link href="/settings" aria-label="Settings" className="p-1 hover:text-neutral-500">
              <SettingsIcon />
            </Link>
          )
        }
      />

      <section className="px-4 pt-4">
        <div className="flex items-center gap-6">
          {stories.length > 0 ? (
            <button type="button" onClick={() => setWatching(true)} aria-label={`View ${profile.username}'s story`}>
              <StoryRing seen={stories.every((s) => s.seen)}>
                <Avatar user={profile} size="lg" />
              </StoryRing>
            </button>
          ) : (
            <Avatar user={profile} size="lg" />
          )}
          <dl className="flex flex-1 justify-around text-center">
            {(
              [
                ["Posts", stats.posts],
                ["Followers", stats.followers],
                ["Following", stats.following],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-sm text-neutral-600">{label}</dt>
                <dd className="text-lg font-semibold">{compactNumber(value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-3 text-sm">
          {profile.fullName && <p className="font-semibold">{profile.fullName}</p>}
          {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Link
                href="/settings"
                className="flex-1 rounded-lg bg-neutral-100 py-1.5 text-center text-sm font-semibold hover:bg-neutral-200"
              >
                Edit profile
              </Link>
              <button
                type="button"
                onClick={shareProfile}
                className="flex-1 rounded-lg bg-neutral-100 py-1.5 text-sm font-semibold hover:bg-neutral-200"
              >
                {copied ? "Link copied" : "Share profile"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleFollow}
              disabled={followBusy}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                following ? "bg-neutral-100 hover:bg-neutral-200" : "bg-sky-500 text-white hover:bg-sky-600"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
          )}
          {!isMe && (
            <Link
              href={`/messages/${profile.username}`}
              className="flex-1 rounded-lg bg-neutral-100 py-1.5 text-center text-sm font-semibold hover:bg-neutral-200"
            >
              Message
            </Link>
          )}
        </div>
      </section>

      {watching && stories.length > 0 && (
        <StoryViewer
          groups={[{ author: profile, stories, allSeen: stories.every((s) => s.seen) }]}
          startGroup={0}
          onClose={() => setWatching(false)}
          onSeen={(id) =>
            setState((st) =>
              st.status === "ready" ? { ...st, stories: st.stories.map((s) => (s.id === id ? { ...s, seen: true } : s)) } : st,
            )
          }
          onDeleted={(id) =>
            setState((st) => (st.status === "ready" ? { ...st, stories: st.stories.filter((s) => s.id !== id) } : st))
          }
        />
      )}

      <div role="tablist" aria-label="Profile content" className="mt-4 flex border-t border-neutral-200">
        {(
          [
            ["posts", "Posts", GridIcon],
            ["reels", "Reels", ReelsIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-label={label}
            onClick={() => setTab(id)}
            className={`-mt-px flex flex-1 justify-center border-t py-3 ${
              tab === id ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        posts.length > 0 ? (
          <PostGrid posts={posts} />
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-2xl font-bold">No posts yet</p>
            {isMe && (
              <Link href="/create" className="mt-2 inline-block text-sm font-semibold text-sky-500">
                Share your first photo
              </Link>
            )}
          </div>
        )
      ) : reels.length > 0 ? (
        <PostGrid posts={reels} tall />
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-2xl font-bold">No reels yet</p>
          {isMe && (
            <Link href="/create" className="mt-2 inline-block text-sm font-semibold text-sky-500">
              Share a video
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
