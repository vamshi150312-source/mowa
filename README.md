# Mova

An Instagram-style photo and video sharing app built from the blueprint in `claude.md`.
**Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Java 21 · Spring Boot 4 · PostgreSQL**

## A feed that changes

With Mova's own backend, every refresh of the home feed, Explore and Reels gives a new
order. Home favours recent posts, popular posts and people you follow, with some shuffle;
Reels and Explore are mostly shuffled. Scrolling keeps the same order (the cursor carries
it), so you never see a post twice. Your own new post stays at the top of home for 30
minutes.

The sample accounts also stay active: since your last visit they react to and comment on
each other's recent posts (about 1.5 actions a minute, at most 25 per visit). This only
touches posts by sample accounts, including the demo account, never accounts people sign
up with.

## Messages

Tap the chat icon at the top of Home (it shows how many chats are unread), or **Message** on
anyone's profile. Chats show **Sent** and **Seen**, and big emoji when a message is only emoji.
Double-tap someone's message to ❤️ it, or press and hold (right-click on a computer) to pick
another reaction. Press and hold your own message to copy or unsend it. The **Share** button
on posts and Reels sends the post to one or more people, with an optional note.

With Mova's own backend, sample accounts answer when you message them: they see your
message, type for a few seconds, then reply. They only answer messages from the last 6
hours, and never start chats with accounts people sign up with. The demo account starts with
a few conversations and now and then gets a new message. New messages arrive by polling
(every 2.5 seconds in an open chat, 15 seconds for the unread badge).

## Calls

The phone and camera buttons at the top of a chat start an audio or video call. The person
you call gets a full-screen ringing screen (with a ringtone) on any page of the app. In a
call you can mute, turn your camera off, and switch between front and back cameras. Each
call is recorded in the chat ("Video call · 2:31", "Missed audio call") with a button to
call back. Unanswered calls stop ringing after 40 seconds. Sample accounts never answer.

Audio and video go directly between the two devices (WebRTC). The server only passes along
the setup messages, by polling. On the same Wi-Fi this always works. Across different
networks it uses public STUN servers, which works for most home connections; some mobile
and office networks would also need a TURN relay server, which isn't set up.

**Calling from phones and other computers.** Browsers only allow the camera and microphone
on secure pages: `localhost`, or HTTPS. To call between devices on your network, start the
server with

```bash
npm run dev:https
```

and open the `https://192.168.x.x:3000` address it prints. The certificate is self-signed,
so each device warns about it once: choose **Advanced → Proceed** (Chrome/Edge) or **Show
details → visit this website** (Safari). The certificate is made automatically, and
remade if your computer's network address changes.

## Music

Many stock clips have no sound of their own, so videos and stories can have a soundtrack
from a built-in library (`src/lib/music.ts`), chosen in Create with **Add music**. The
track name shows on the post, reel or story and replaces the video's own sound. Stories
open with sound on; in Reels, if the browser starts muted (it does after a page reload),
tap **Tap for sound**.

Music by Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Stories

Post a photo or video that disappears after **24 hours**. Your story and everyone else's
appear as rings at the top of the home feed (colourful = new, grey = watched); profile
pictures get the same ring. Tap a ring to watch: tap right/left to skip, hold to pause,
swipe down or press Esc to close. React with an emoji, and on your own story see who viewed
it and how they reacted. Add one with the **+** on "Your story" or Create → Story.

Expired stories, their views and their uploaded files are deleted automatically. With the
Spring Boot backend, the sample accounts post a fresh set of stories once a day so there's
always something to watch.

## Reels

A full-screen, swipe-up feed of every video on Mova (the Reels tab). Videos play with
sound as they come into view. Tap to mute, double-tap to react, press and hold to pause.
The side rail has reactions, comments (in a sheet, so the video keeps playing), share
and sound. Profiles have a Reels tab, and any video tile opens in Reels. On a computer,
use the arrow keys (or j/k) to move between reels and m to mute.

## What Mova does that Instagram doesn't

- **Emoji reactions.** Six reactions instead of just a heart: ❤️ 🔥 😂 😮 😢 👏. Tap the heart
  to like; press and hold it (or tap the smiley button) to pick another. Double-tap still likes.
- **Polls on any post.** Add a 2–4 option poll when you create a post. Results appear once you
  vote, and you can change your vote. Who voted for what stays private.
- **Schedule posts.** Pick a date and time up to 30 days ahead. Until then only you can see the
  post, marked "Scheduled" on your profile.
- **Filters for photos and videos.** Eight filters, applied when the post is shown, so your
  original file is never changed.
- **Mindful mode** (Settings). A daily break reminder with a one-minute breathing exercise, a
  7-day screen-time chart, and an option to hide reaction, comment and vote counts. These
  settings stay on your device.

## Quick start

You need **Java 21+**, **Maven** and **PostgreSQL** (16 or newer), plus Node.js for the
frontend.

1. **Create the database** (once), e.g. in `psql` as the `postgres` user:

   ```sql
   create role mova login password 'choose-a-password';
   create database mova owner mova;
   ```

   Then put the password in `backend/.env.db` (git-ignored):

   ```
   DB_PASSWORD=choose-a-password
   ```

2. **Start the backend** (Spring Boot, port 8080):

   ```bash
   npm run backend
   ```

   The first start creates the tables, then fills the database: from `data/db.json` if
   you have one from the old Node backend, otherwise with the sample accounts and content.

3. **Start the frontend** (Next.js, port 3000) in a second terminal:

   ```bash
   npm install
   npm run dev
   ```

Open http://localhost:3000 and log in with the demo account:
**demo@mova.dev / password123**. You can also sign up for a new account.

Every sample account (e.g. `ava@mova.dev`, `zoe@mova.dev`) uses the same password.

To use the app from your phone or another computer on the same Wi-Fi, run
`npm run dev:https` instead of `npm run dev` and open the address it prints (see [Calls](#calls)).

### The backend: Spring Boot + PostgreSQL

The API lives in [`backend/`](backend/): a Spring Boot 4 app (Java 21) with PostgreSQL,
using plain SQL through `JdbcTemplate` and Flyway migrations
([`backend/src/main/resources/db/migration`](backend/src/main/resources/db/migration)).
Next.js forwards every `/api/...` request to it (see `next.config.ts`), so the browser
only ever talks to one address and session cookies, uploads and media URLs just work.

- **Data:** users, posts, comments, reactions, polls, follows, stories, messages and
  sessions are in PostgreSQL. Uploaded photos and videos are files in `data/uploads/`,
  served from `/api/media/...` (with range requests, so videos stream and seek).
- **Passwords** are hashed with scrypt; sessions are random tokens in an HTTP-only cookie.
- **Calls** keep their short-lived state in the backend's memory; how each call went is
  saved as a chat message.
- **Sample content:** 13 sample accounts and 90 posts (51 photos from Unsplash and 39 videos
  from MDN and Pexels), with reactions, comments, follows, polls, filters, stories and chats
  ([`seed/samples.json`](backend/src/main/resources/seed/samples.json)).
- **Settings** are in [`application.properties`](backend/src/main/resources/application.properties);
  `DB_URL`, `DB_USER`, `DB_PASSWORD`, `PORT` and `MOVA_DATA_DIR` override them. The frontend
  finds the backend at `http://127.0.0.1:8080`, or `API_URL` if set. The backend only listens
  on this computer; other devices reach it through the frontend.
- **Reset to sample data:** stop the backend, then drop and recreate the `mova` database
  (and move `data/db.json` out of the way, or it's imported again). Start the backend.

## Features

| Feature | Where |
| --- | --- |
| Backend API: Spring Boot controllers | `backend/src/main/java/dev/mova/api` |
| Database schema (PostgreSQL) | `backend/src/main/resources/db/migration` |
| Auth context, login and sign-up with validation | `src/context/AuthContext.tsx`, `src/app/login`, `src/app/signup` |
| Media upload: photos (cropped/resized) and videos (≤ 60 s, ≤ 50 MB) | `src/app/create/page.tsx`, `src/lib/image.ts` |
| Video posts: autoplay in view, tap for sound, double-tap to like | `src/components/PostVideo.tsx`, `src/components/PostCard.tsx` |
| Infinite feed with cursor pagination | `src/components/Feed.tsx`, `src/lib/useInfinitePosts.ts` |
| Double-tap to like, animated heart, optimistic updates | `src/components/PostCard.tsx` |
| Ranked feed that changes each refresh, live sample activity | `backend/.../api/PostController.java` (score), `backend/.../service/Simulation.java` |
| Music for videos and stories | `src/lib/music.ts`, `src/lib/useSoundtrack.ts`, `src/components/MusicPicker.tsx` |
| Stories: 24-hour photos/videos, viewer, reactions, viewer list | `src/components/StoriesBar.tsx`, `src/components/StoryViewer.tsx`, `src/components/StoryComposer.tsx` |
| Reels: full-screen video feed, comments sheet, profile Reels tab | `src/app/reels/page.tsx`, `src/components/ReelPlayer.tsx`, `src/components/CommentsSheet.tsx` |
| Audio and video calls (WebRTC) | `src/context/CallContext.tsx`, `src/lib/callLink.ts`, `src/components/CallScreen.tsx`, `backend/.../service/Calls.java` |
| Direct messages: inbox, chats, Seen, reactions, unsend, share posts | `src/app/messages`, `src/components/ChatMessage.tsx`, `src/components/SendToSheet.tsx` |
| Emoji reactions with a press-and-hold picker | `src/components/ReactionPicker.tsx`, `src/components/PostCard.tsx` |
| Polls on posts | `src/components/PollView.tsx`, `src/app/create/page.tsx` |
| Scheduled posts | `src/app/create/page.tsx`, `backend/.../api/PostController.java` |
| Photo and video filters | `src/lib/postOptions.ts` |
| Mindful mode: break reminder, screen time, hide counts | `src/lib/mindful.ts`, `src/components/MindfulBreak.tsx`, `src/app/settings/page.tsx` |
| Comments with live refresh | `src/app/p/[id]/page.tsx` |
| Profile with stats, bio, follow, share, 3-column grid | `src/app/u/[username]/page.tsx` |
| Settings: edit profile and photo, change password, log out, delete account | `src/app/settings/page.tsx` |
| Search all users, suggested accounts, endless explore grid | `src/app/search/page.tsx`, `src/components/SuggestedUsers.tsx` |
| Mobile-first layout with bottom nav | `src/components/AppShell.tsx`, `src/components/BottomNav.tsx` |
| Sample data | `src/lib/mockData.ts` |

## Project layout

```
src/
  app/
    ...             pages: feed, login, signup, create, search, settings, messages, u/[username], p/[id]
  components/       PostCard, Feed, PostGrid, SuggestedUsers, Avatar, BottomNav, ...
  context/          AuthContext
  lib/
    api.ts          picks the backend
    backends/       http.ts: the client for the Spring Boot API
    types.ts        shared types + Backend interface
backend/            Spring Boot + PostgreSQL API
  src/main/java/dev/mova/
    api/            controllers (accounts, posts, users, stories, chats, calls, media)
    service/        views, simulation of sample activity, calls, media, seeding/import
    domain/         API types (Dto), database rows, validation, times
  src/main/resources/
    db/migration/   Flyway SQL migrations
    seed/           sample accounts and content
data/               uploads/ (git-ignored); db.json from the old Node backend, if any
```

## Scaling up (see `claude.md`)

- **Image CDN:** photos are already cropped to a square, capped at 1080px and
  re-encoded as JPEG in the browser. For production, store uploads in object storage
  (S3, Cloudflare R2) behind a CDN or an image service like Cloudinary/Imgix.
- **Pagination:** the feed and explore grid load posts in pages using a `created_at` cursor.
- **Realtime:** the app polls the Spring Boot backend (new comments every 5 seconds, chats
  every 2.5 seconds). Server-Sent Events or WebSockets would make this instant.
