import type { Story, StoryGroup } from "./types";

/**
 * Groups active stories by author for the stories bar: you first, then people with
 * unseen stories (people you follow before others), then people you've fully watched.
 * Within each tier, whoever posted most recently comes first. `stories` must be oldest first.
 */
export function groupStories(stories: Story[], meId: string | null, followedIds: Set<string>): StoryGroup[] {
  const byUser = new Map<string, Story[]>();
  for (const story of stories) byUser.set(story.author.id, [...(byUser.get(story.author.id) ?? []), story]);
  const groups: StoryGroup[] = [...byUser.values()].map((list) => ({
    author: list[0].author,
    stories: list,
    allSeen: list.every((s) => s.seen),
  }));
  const rank = (g: StoryGroup) => (g.author.id === meId ? 0 : g.allSeen ? 3 : followedIds.has(g.author.id) ? 1 : 2);
  const latest = (g: StoryGroup) => g.stories[g.stories.length - 1].createdAt;
  return groups.sort((a, b) => rank(a) - rank(b) || latest(b).localeCompare(latest(a)));
}
