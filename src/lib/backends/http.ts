// Talks to Mova's Spring Boot backend (backend/), which Next.js proxies at /api.
// All data is stored in PostgreSQL, so every browser and device sees the same users.
import type {
  Backend,
  Call,
  CallSignal,
  ChatSummary,
  ChatThread,
  Comment,
  FeedPage,
  Message,
  Poll,
  Post,
  Profile,
  ProfileStats,
  Story,
  StoryGroup,
  StoryViewer,
} from "../types";

const POLL_MS = 5000;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, init);
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export function createHttpBackend(): Backend {
  const authListeners = new Set<(user: Profile | null) => void>();
  const emitAuth = (user: Profile | null) => authListeners.forEach((cb) => cb(user));

  return {
    async getCurrentUser() {
      return (await call<{ user: Profile | null }>("GET", "auth/me")).user;
    },

    onAuthChange(callback) {
      authListeners.add(callback);
      return () => authListeners.delete(callback);
    },

    async signUp(input) {
      const { user } = await call<{ user: Profile }>("POST", "auth/signup", input);
      emitAuth(user);
      return user;
    },

    async signIn(email, password) {
      const { user } = await call<{ user: Profile }>("POST", "auth/login", { email, password });
      emitAuth(user);
      return user;
    },

    async signOut() {
      await call("POST", "auth/logout");
      emitAuth(null);
    },

    async updateProfile({ fullName, username, bio, avatar }) {
      const form = new FormData();
      form.set("fullName", fullName);
      form.set("username", username);
      form.set("bio", bio);
      if (avatar) form.set("avatar", avatar, "avatar.jpg");
      if (avatar === null) form.set("removeAvatar", "1");
      const { user } = await call<{ user: Profile }>("PATCH", "me", form);
      emitAuth(user);
      return user;
    },

    async changePassword(currentPassword, newPassword) {
      await call("POST", "me/password", { currentPassword, newPassword });
    },

    async deleteAccount() {
      await call("DELETE", "me");
      emitAuth(null);
    },

    getFeed(cursor, limit, kind = "all") {
      const params = new URLSearchParams({ limit: String(limit), kind });
      if (cursor) params.set("cursor", cursor);
      return call<FeedPage>("GET", `feed?${params}`);
    },

    async getPost(id) {
      return (await call<{ post: Post | null }>("GET", `posts/${encodeURIComponent(id)}`)).post;
    },

    async createPost({ media, mediaType, caption, filter, music, poll, publishAt }) {
      const form = new FormData();
      const ext = media.type.split("/")[1] ?? "bin";
      form.set("media", media, `upload.${ext}`);
      form.set("mediaType", mediaType);
      form.set("caption", caption);
      form.set("filter", filter);
      if (music) form.set("music", music);
      if (poll) form.set("poll", JSON.stringify(poll));
      if (publishAt) form.set("publishAt", publishAt);
      return (await call<{ post: Post }>("POST", "posts", form)).post;
    },

    async setReaction(postId, reaction) {
      const path = `posts/${encodeURIComponent(postId)}/reaction`;
      await (reaction ? call("PUT", path, { reaction }) : call("DELETE", path));
    },

    async votePoll(postId, option) {
      return (await call<{ poll: Poll }>("PUT", `posts/${encodeURIComponent(postId)}/vote`, { option })).poll;
    },

    async getComments(postId) {
      return (await call<{ comments: Comment[] }>("GET", `posts/${encodeURIComponent(postId)}/comments`)).comments;
    },

    async addComment(postId, body) {
      return (await call<{ comment: Comment }>("POST", `posts/${encodeURIComponent(postId)}/comments`, { body }))
        .comment;
    },

    subscribeToPost(_postId, onChange) {
      // No push channel here, so poll while the tab is visible.
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") onChange();
      }, POLL_MS);
      return () => clearInterval(timer);
    },

    async getProfileByUsername(username) {
      return (await call<{ user: Profile | null }>("GET", `users/by-username/${encodeURIComponent(username)}`)).user;
    },

    getProfileStats(userId) {
      return call<ProfileStats>("GET", `users/${encodeURIComponent(userId)}/stats`);
    },

    async getUserPosts(userId) {
      return (await call<{ posts: Post[] }>("GET", `users/${encodeURIComponent(userId)}/posts`)).posts;
    },

    async isFollowing(userId) {
      return (await call<{ following: boolean }>("GET", `users/${encodeURIComponent(userId)}/follow`)).following;
    },

    async setFollow(userId, follow) {
      await call(follow ? "PUT" : "DELETE", `users/${encodeURIComponent(userId)}/follow`);
    },

    async searchUsers(query) {
      if (!query.trim()) return [];
      return (await call<{ users: Profile[] }>("GET", `search?q=${encodeURIComponent(query)}`)).users;
    },

    async getSuggestedUsers(limit) {
      return (await call<{ users: Profile[] }>("GET", `suggested?limit=${limit}`)).users;
    },

    async getStories() {
      return (await call<{ groups: StoryGroup[] }>("GET", "stories")).groups;
    },

    async getUserStories(userId) {
      return (await call<{ stories: Story[] }>("GET", `users/${encodeURIComponent(userId)}/stories`)).stories;
    },

    async createStory({ media, mediaType, filter, music, caption }) {
      const form = new FormData();
      const ext = media.type.split("/")[1] ?? "bin";
      form.set("media", media, `story.${ext}`);
      form.set("mediaType", mediaType);
      form.set("filter", filter);
      if (music) form.set("music", music);
      form.set("caption", caption);
      return (await call<{ story: Story }>("POST", "stories", form)).story;
    },

    async deleteStory(storyId) {
      await call("DELETE", `stories/${encodeURIComponent(storyId)}`);
    },

    async markStorySeen(storyId) {
      await call("PUT", `stories/${encodeURIComponent(storyId)}/view`);
    },

    async reactToStory(storyId, reaction) {
      await call("PUT", `stories/${encodeURIComponent(storyId)}/reaction`, { reaction });
    },

    async getStoryViewers(storyId) {
      return (await call<{ viewers: StoryViewer[] }>("GET", `stories/${encodeURIComponent(storyId)}/viewers`)).viewers;
    },

    async getChats() {
      return (await call<{ chats: ChatSummary[] }>("GET", "chats")).chats;
    },

    getChat(userId) {
      return call<ChatThread>("GET", `chats/${encodeURIComponent(userId)}`);
    },

    async sendMessage(userId, body, postId = null) {
      return (await call<{ message: Message }>("POST", `chats/${encodeURIComponent(userId)}`, { body, postId })).message;
    },

    async reactToMessage(messageId, reaction) {
      await call("PUT", `messages/${encodeURIComponent(messageId)}/reaction`, { reaction });
    },

    async unsendMessage(messageId) {
      await call("DELETE", `messages/${encodeURIComponent(messageId)}`);
    },

    async getUnreadChatCount() {
      return (await call<{ count: number }>("GET", "chats/unread")).count;
    },

    calls: {
      async start(userId, kind) {
        return (await call<{ call: Call }>("POST", "calls", { userId, kind })).call;
      },
      async incoming() {
        return (await call<{ call: Call | null }>("GET", "calls/incoming")).call;
      },
      poll(callId, after) {
        return call<{ call: Call; signals: CallSignal[] }>("GET", `calls/${encodeURIComponent(callId)}?after=${after}`);
      },
      async accept(callId) {
        await call("POST", `calls/${encodeURIComponent(callId)}/accept`);
      },
      async end(callId) {
        await call("POST", `calls/${encodeURIComponent(callId)}/end`);
      },
      async signal(callId, type, data) {
        await call("POST", `calls/${encodeURIComponent(callId)}/signal`, { type, data });
      },
    },
  };
}
