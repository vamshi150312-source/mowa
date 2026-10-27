// Post options shared by the UI and both backends: reactions, filters, polls and scheduling.

export const REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (v: unknown): v is Reaction => REACTIONS.includes(v as Reaction);
export const REACTION_NAMES: Record<Reaction, string> = {
  "❤️": "Love",
  "🔥": "Fire",
  "😂": "Haha",
  "😮": "Wow",
  "😢": "Sad",
  "👏": "Applause",
};

/**
 * Filters are stored as a name on the post and applied with CSS when it's shown, so the
 * original upload is never changed and the same filters work on videos.
 */
export const FILTERS = [
  { id: "none", name: "Normal", css: "" },
  { id: "vivid", name: "Vivid", css: "saturate(1.45) contrast(1.08)" },
  { id: "warm", name: "Warm", css: "sepia(0.25) saturate(1.35) hue-rotate(-8deg)" },
  { id: "cool", name: "Cool", css: "saturate(1.1) hue-rotate(14deg) brightness(1.04)" },
  { id: "fade", name: "Fade", css: "contrast(0.85) brightness(1.12) saturate(0.75)" },
  { id: "retro", name: "Retro", css: "sepia(0.5) contrast(1.05) saturate(1.25)" },
  { id: "dream", name: "Dream", css: "brightness(1.08) saturate(1.3) contrast(0.92) hue-rotate(-12deg)" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.25)" },
] as const;
export type FilterId = (typeof FILTERS)[number]["id"];
export const isFilter = (v: unknown): v is FilterId => FILTERS.some((f) => f.id === v);
export const filterCss = (id: string): string | undefined => FILTERS.find((f) => f.id === id)?.css || undefined;

export type NewPoll = { question: string; options: string[] };
export const POLL_MAX_QUESTION = 100;
export const POLL_MAX_OPTION = 40;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;

/** Returns an error message, or null if the poll is valid. Expects trimmed strings. */
export function validatePoll({ question, options }: NewPoll): string | null {
  if (!question) return "Add a question to your poll.";
  if (question.length > POLL_MAX_QUESTION) return `Poll questions can be up to ${POLL_MAX_QUESTION} characters.`;
  if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS)
    return `Polls need ${POLL_MIN_OPTIONS} to ${POLL_MAX_OPTIONS} options.`;
  if (options.some((o) => !o)) return "Fill in every poll option, or remove the empty ones.";
  if (options.some((o) => o.length > POLL_MAX_OPTION)) return `Poll options can be up to ${POLL_MAX_OPTION} characters.`;
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "Poll options must be different.";
  return null;
}

export const MAX_SCHEDULE_DAYS = 30;

/** Returns an error message, or null if `iso` is a valid time to publish a scheduled post. */
export function validatePublishAt(iso: string, now = Date.now()): string | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "Pick a date and time to post.";
  if (time <= now) return "Pick a time in the future.";
  if (time > now + MAX_SCHEDULE_DAYS * 86_400_000) return `You can schedule up to ${MAX_SCHEDULE_DAYS} days ahead.`;
  return null;
}

/** A scheduled post's `createdAt` is its publish time, so it's still in the future. */
export const isScheduled = (post: { createdAt: string }) => new Date(post.createdAt).getTime() > Date.now();

/** Stories disappear this long after they're posted. */
export const STORY_HOURS = 24;
export const STORY_MAX_CAPTION = 200;
/** How long a photo story stays on screen. Video stories play for their full length. */
export const STORY_IMAGE_SECONDS = 5;
