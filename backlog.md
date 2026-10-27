# Mova backlog

_Last updated: 2026-10-13_

## Done today

**App basics**
- Built the Instagram-style app from `claude.md`: Next.js 15, React 19, Tailwind 4, TypeScript.
- It runs on a built-in backend (`data/db.json`) and has a Supabase backend kept in step with it.
- Renamed the app from Snapgram to **Mova** and gave it a new logo: a gradient tile with an "M", plus an Outfit-font wordmark.

**Posts and feed**
- Added photo and video posts, settings (edit profile, password, delete account) and better user search.
- Added features Instagram doesn't have:
  - six emoji reactions;
  - polls;
  - scheduled posts;
  - filters for photos and videos;
  - Mindful mode: break reminders, screen time, and hiding counts.
- The home feed, Explore and Reels give a new order on every refresh. Sample accounts keep reacting and commenting.

**Reels, stories and sound**
- Added full-screen Reels: 39 sample videos, a comments sheet, and a Reels tab on profiles.
- Added stories: they disappear after 24 hours and have a viewer, reactions and a viewer list.
- Fixed silent Reels and stories with a library of 18 music tracks (CC BY, Kevin MacLeod).

**Speed**
- Cut unneeded re-renders: posts and reels are memoized, and selectors are used for Mindful settings.
- Data-format upgrades apply on hot reload, without restarting the server.

**Messages (chats)**
- Inbox and chat screens, with Sent and Seen labels and a typing indicator.
- Message reactions and unsend.
- An unread badge on the Home screen.
- A **Message** button on profiles.
- A **Share → Send to** sheet on posts and Reels.
- Sample accounts reply when you message them.

**Audio and video calls (WebRTC)**
- Ringing screen with a ringtone, plus mute, camera on/off and switching cameras.
- Each call is recorded in the chat, with a **Call back** button.
- Tested with two accounts over the network address.

**Use from other devices**
- `npm run dev:https` serves the app on HTTPS with a self-signed certificate, so phones on the same Wi-Fi can use the camera and microphone.
- It is running now at **https://192.168.0.72:3000**.

**Backend moved to Java Spring Boot + PostgreSQL (2026-10-13)**
- New API in `backend/` (Spring Boot 4, Java 21, JdbcTemplate, Flyway). It covers every endpoint the old Node backend had.
- Database `mova` on the local PostgreSQL 16, with its own `mova` user. The password is in `backend/.env.db`.
- Imported everything from `data/db.json`: 14 users (including `sujeeth`, who keeps the same password), 90 posts, chats and sessions. Uploads stay in `data/uploads/`.
- Next.js forwards `/api/*` to `http://127.0.0.1:8080`, so the frontend didn't change.
- The old Node backend (`src/app/api`, `src/server`) and `src/lib/mockData.ts` were removed.
- Tested: same responses as the old backend on the read endpoints, all write paths, a 45 MB upload, and the chat and call browser tests.
- To run it, use two terminals: `npm run backend`, then `npm run dev` (or `npm run dev:https`).

## Next steps (in order)

1. **Put the project under version control.** The folder isn't a git repository yet.
   - Run `git init`, check that `.gitignore` covers `data/`, `certificates/`, `node_modules/`, `backend/target/` and `backend/.env.db`.
   - Make a first commit before changing anything else.

2. **Test calls on real devices.** So far they've only been tested with fake cameras.
   - Run `npm run backend`, then `npm run dev:https`, and open the printed `https://…:3000` address on two phones, accepting the certificate warning on each.
   - Log in as `demo@mova.dev` on one and `zoe@mova.dev` on the other (password `password123`).
   - Try an audio call and a video call: mute, camera off, switching cameras, declining, and leaving a call unanswered.

3. **Fix: incoming calls are missed when the tab is in the background.** The check for incoming calls is skipped while the tab is hidden, as are the chat polls.
   - Keep checking for calls, more slowly, while hidden; or move to push updates (step 6).
   - Consider a browser notification for incoming calls and messages.

4. **Run a production build.** It hasn't been run since chats and calls were added.
   - Stop the dev server first, because building while it runs breaks it.
   - Run `npm run build` and fix any errors.
   - Restart with `npm run dev:https`.

5. **Review `npm audit`.** It reported warnings after `selfsigned` was installed. Don't use `--force` without checking what it changes.

6. **Replace polling with push updates.** Chats check every 2.5 s, the badge every 15 s and calls every 2 s.
   - Server-Sent Events (Spring's `SseEmitter`) or WebSockets from the Spring Boot backend would make messages and calls instant.
   - They would also cut down on requests.

7. **Add a TURN relay for calls across networks.** Some mobile-data and office networks block direct connections.
   - Get a TURN server: a hosted service, or your own coturn.
   - Read its address and login from environment variables into `ICE_SERVERS` in `src/lib/callLink.ts`.

8. **Add backend tests.** The Spring Boot app has none yet.
   - Integration tests for the controllers against a test PostgreSQL (Testcontainers), starting with auth, posts and chats.

9. ~~Decide about Supabase.~~ Done 2026-10-13: removed. Spring Boot + PostgreSQL is the only backend.

10. **Deploy so the app works outside your Wi-Fi.**
    - The backend is a standard Spring Boot jar (`mvn -f backend/pom.xml package`) plus PostgreSQL. A VPS, Render, Railway or Fly.io all work.
    - Uploads need persistent disk, or move them to object storage (S3, Cloudflare R2).
    - Run the Next.js frontend with `API_URL` pointing at the backend.

11. **Smaller improvements:**
    - Load older messages past the latest 200.
    - Voice messages.
    - Group chats.
    - Image optimization and a CDN (see "Scalability" in `claude.md`).

## Open question

Earlier request: "for every change don't run all files and components". I took this to mean cutting unneeded re-renders and avoiding server restarts, and did that. I asked whether it meant something else, but it hasn't been confirmed yet.
