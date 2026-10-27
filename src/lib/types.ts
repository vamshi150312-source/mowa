import type { FilterId, NewPoll, Reaction } from "./postOptions";

export type { FilterId, NewPoll, Reaction };

export type Profile = {
  id: string;
  username: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
};

export type MediaType = "image" | "video";

/** How many people picked each reaction. Reactions nobody picked are left out. */
export type ReactionCounts = Partial<Record<Reaction, number>>;

export type Poll = {
  question: string;
  options: { text: string; votes: number }[];
  /** Index of the option the current user picked, or null if they haven't voted. */
  myVote: number | null;
};

export type Post = {
  id: string;
  author: Profile;
  mediaType: MediaType;
  /** URL of the photo or video. */
  imageUrl: string;
  /** Applied with CSS when shown; see FILTERS in postOptions.ts. */
  filter: FilterId;
  /** Soundtrack id from src/lib/music.ts, or null to use the video's own sound. */
  music: string | null;
  caption: string;
  /** When the post goes live. A scheduled post has a future time and only its author can see it. */
  createdAt: string;
  reactions: ReactionCounts;
  myReaction: Reaction | null;
  commentCount: number;
  poll: Poll | null;
};

export type NewPost = {
  media: Blob;
  mediaType: MediaType;
  caption: string;
  filter: FilterId;
  /** Soundtrack id (videos only), or null. */
  music: string | null;
  poll: NewPoll | null;
  /** ISO time to publish at, or null to post now. */
  publishAt: string | null;
};

/** A story ("status"): a photo or video that disappears 24 hours after it's posted. */
export type Story = {
  id: string;
  author: Profile;
  mediaType: MediaType;
  mediaUrl: string;
  filter: FilterId;
  /** Soundtrack id from src/lib/music.ts, or null. */
  music: string | null;
  caption: string;
  createdAt: string;
  expiresAt: string;
  /** Has the current user viewed it? Always true for your own stories. */
  seen: boolean;
  /** The current user's reaction to it. */
  myReaction: Reaction | null;
  /** How many people have viewed it. Only included for your own stories. */
  viewCount?: number;
};

/** One person's active stories, oldest first, as shown in the stories bar. */
export type StoryGroup = { author: Profile; stories: Story[]; allSeen: boolean };

export type StoryViewer = { user: Profile; viewedAt: string; reaction: Reaction | null };

export type NewStory = { media: Blob; mediaType: MediaType; filter: FilterId; music: string | null; caption: string };

export type Comment = {
  id: string;
  postId: string;
  author: Profile;
  body: string;
  createdAt: string;
};

/** A direct message between two people. */
export type Message = {
  id: string;
  senderId: string;
  body: string;
  /** A post shared into the chat, or null. */
  post: Post | null;
  /** True when a post was shared but isn't available anymore. */
  postUnavailable: boolean;
  createdAt: string;
  /** When the recipient read it; null while unread. */
  readAt: string | null;
  /** The recipient's reaction to it. */
  reaction: Reaction | null;
  /** Set when this is the record of a call; the sender is the person who called. */
  call: CallRecord | null;
};

export type CallKind = "audio" | "video";

/** How a call went, as shown in the chat. */
export type CallRecord = {
  kind: CallKind;
  /** completed: answered · missed: not answered in time, or the caller hung up first · declined. */
  outcome: "completed" | "missed" | "declined";
  /** Seconds from answering to hanging up (completed calls). */
  durationSec: number;
};

/** A call in progress. */
export type Call = {
  id: string;
  kind: CallKind;
  caller: Profile;
  callee: Profile;
  status: "ringing" | "active" | "ended";
  /** Why it ended: declined, missed (no answer), busy, or completed (someone hung up). */
  endReason: "declined" | "missed" | "busy" | "completed" | null;
};

/** WebRTC signalling messages exchanged through the server while a call connects. */
export type CallSignal = { seq: number; type: "offer" | "answer" | "candidate"; data: unknown };

/** Call signalling, relayed by the backend while two browsers set up a WebRTC call. */
export interface CallSignaling {
  start(userId: string, kind: CallKind): Promise<Call>;
  /** A call ringing for the current user, if any. */
  incoming(): Promise<Call | null>;
  /** The call's state, plus signals from the other person with seq > `after`. */
  poll(callId: string, after: number): Promise<{ call: Call; signals: CallSignal[] }>;
  accept(callId: string): Promise<void>;
  /** Hang up, cancel or decline. */
  end(callId: string): Promise<void>;
  signal(callId: string, type: CallSignal["type"], data: unknown): Promise<void>;
}

/** One row of the inbox: a conversation with one person. */
export type ChatSummary = { user: Profile; lastMessage: Message; unread: number };

export type ChatThread = {
  /** Oldest first; the most recent 200. */
  messages: Message[];
  /** The other person is typing a reply (built-in backend only). */
  typing: boolean;
};

export type ProfileStats = {
  posts: number;
  followers: number;
  following: number;
};

/** "all": home feed · "videos": Reels · "explore": the Search page grid. */
export type FeedKind = "all" | "videos" | "explore";

export type FeedPage = {
  posts: Post[];
  /** Pass back to getFeed to load the next page; null when there are no more posts. */
  nextCursor: string | null;
};

export type SignUpInput = {
  email: string;
  password: string;
  username: string;
  fullName: string;
};

export type ProfileUpdate = {
  fullName: string;
  username: string;
  bio: string;
  /** A new photo, null to remove the current one, or undefined to keep it. */
  avatar?: Blob | null;
};

/** Everything the UI needs from the backend: the Spring Boot API (src/lib/backends/http.ts). */
export interface Backend {
  getCurrentUser(): Promise<Profile | null>;
  onAuthChange(callback: (user: Profile | null) => void): () => void;
  signUp(input: SignUpInput): Promise<Profile>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  updateProfile(update: ProfileUpdate): Promise<Profile>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;

  /**
   * A page of posts. The built-in backend ranks them (recency, popularity, people you
   * follow) with some randomness, so each refresh is a little different; pass the
   * returned cursor back to continue the same ordering.
   */
  getFeed(cursor: string | null, limit: number, kind?: FeedKind): Promise<FeedPage>;
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost): Promise<Post>;
  /** Sets the current user's reaction to a post; null removes it. */
  setReaction(postId: string, reaction: Reaction | null): Promise<void>;
  /** Votes (or changes the vote) in a post's poll and returns the updated results. */
  votePoll(postId: string, option: number): Promise<Poll>;

  getComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, body: string): Promise<Comment>;
  /** Calls `onChange` when the post's comments or reactions change elsewhere. Returns an unsubscribe fn. */
  subscribeToPost(postId: string, onChange: () => void): () => void;

  getProfileByUsername(username: string): Promise<Profile | null>;
  getProfileStats(userId: string): Promise<ProfileStats>;
  getUserPosts(userId: string): Promise<Post[]>;
  isFollowing(userId: string): Promise<boolean>;
  setFollow(userId: string, follow: boolean): Promise<void>;
  searchUsers(query: string): Promise<Profile[]>;
  /** People the current user doesn't follow yet, most-followed first. */
  getSuggestedUsers(limit: number): Promise<Profile[]>;

  /** Everyone with active stories: you first, then unseen (people you follow first), then seen. */
  getStories(): Promise<StoryGroup[]>;
  getUserStories(userId: string): Promise<Story[]>;
  createStory(story: NewStory): Promise<Story>;
  deleteStory(storyId: string): Promise<void>;
  markStorySeen(storyId: string): Promise<void>;
  /** Reacts to someone's story (null removes the reaction). The author sees it with the viewer list. */
  reactToStory(storyId: string, reaction: Reaction | null): Promise<void>;
  /** Who viewed one of your stories, most recent first. */
  getStoryViewers(storyId: string): Promise<StoryViewer[]>;

  /** Your conversations, most recent first. */
  getChats(): Promise<ChatSummary[]>;
  /** Your messages with one person. Opening a chat marks their messages to you as read. */
  getChat(userId: string): Promise<ChatThread>;
  /** Sends a message; `postId` shares a post along with it (the text can then be empty). */
  sendMessage(userId: string, body: string, postId?: string | null): Promise<Message>;
  /** Reacts to a message someone sent you; null removes the reaction. */
  reactToMessage(messageId: string, reaction: Reaction | null): Promise<void>;
  /** Deletes a message you sent, for both people. */
  unsendMessage(messageId: string): Promise<void>;
  /** How many conversations have messages you haven't read. */
  getUnreadChatCount(): Promise<number>;

  /** Audio and video calls. */
  calls: CallSignaling;
}
