// Music you can add to videos and stories. All tracks are by Kevin MacLeod (incompetech.com),
// licensed under Creative Commons: By Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/).

export type Track = { id: string; title: string; artist: string; mood: string; url: string };

const kevin = (id: string, title: string, mood: string): Track => ({
  id,
  title,
  artist: "Kevin MacLeod",
  mood,
  url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`,
});

export const TRACKS: Track[] = [
  kevin("carefree", "Carefree", "Happy"),
  kevin("life-of-riley", "Life of Riley", "Upbeat"),
  kevin("monkeys-spinning-monkeys", "Monkeys Spinning Monkeys", "Playful"),
  kevin("fluffing-a-duck", "Fluffing a Duck", "Silly"),
  kevin("sneaky-snitch", "Sneaky Snitch", "Mischief"),
  kevin("funky-chunk", "Funky Chunk", "Workout"),
  kevin("hyperfun", "Hyperfun", "Energetic"),
  kevin("club-diver", "Club Diver", "Club"),
  kevin("groove-grove", "Groove Grove", "Groovy"),
  kevin("inspired", "Inspired", "Inspiring"),
  kevin("dreamer", "Dreamer", "Dreamy"),
  kevin("chill-wave", "Chill Wave", "Chill"),
  kevin("airport-lounge", "Airport Lounge", "Lounge"),
  kevin("bossa-antigua", "Bossa Antigua", "Bossa nova"),
  kevin("jazz-brunch", "Jazz Brunch", "Jazz"),
  kevin("easy-lemon", "Easy Lemon", "Light"),
  kevin("beachfront-celebration", "Beachfront Celebration", "Summer"),
  kevin("night-vigil", "Night Vigil", "Night"),
];

export const MUSIC_CREDIT = "Music by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0";

export const getTrack = (id: string | null | undefined): Track | null => TRACKS.find((t) => t.id === id) ?? null;
export const isTrackId = (v: unknown): v is string => typeof v === "string" && TRACKS.some((t) => t.id === v);
