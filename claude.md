# Blueprint: Instagram-like App with Claude Code

This guide provides a structured, step-by-step roadmap to build a simplified Instagram-like application (web or mobile) using **Claude Code** alongside a modern frontend and backend infrastructure.

---

## 🛠️ Step-by-Step Build Roadmap

### Step 1: Initialize Your Workspace & Stack
Before firing up Claude Code, choose your technology stack. A common, highly efficient stack for this type of application includes:
* **Frontend:** React Native (for iOS/Android mobile apps) or Next.js (for web apps).
* **Backend & Database:** Supabase or Firebase (handles authentication, Postgres database, and media storage out of the box).

**Action:** Create an empty repository, initialize your frontend framework, and open your terminal in that directory.

### Step 2: Set Up Claude Code
Launch Claude Code in your project directory to allow the AI to inspect your file structure and write files directly:
```bash
claude
```

### Step 3: Scaffold the Database Schema
An Instagram clone requires a relational structure to handle users, media, likes, and follows. 
* Ask Claude Code to generate your database migrations or initialization scripts.
* *Example prompt:* `"Create a SQL schema for a Supabase PostgreSQL database containing users, posts (with image URLs and captions), comments, likes, and a follows table for user relationships."`

### Step 4: Implement Authentication
Build the signup, login, and session persistence layer.
* *Example prompt:* `"Create an authentication context using Supabase Auth. Build user login and sign-up screens with responsive form validation."`

### Step 5: Build the Media Upload Pipeline
This is the core infrastructure for an image-sharing application. You need a client-side picker that uploads raw files to cloud storage and saves the public URL to your database.
* *Example prompt:* `"Create a post creation component. Include an image picker, an image preview container, a text input for captions, and a function to upload the file to storage before creating a row in the posts table."`

### Step 6: Create the Main Feed UI
Build the scrollable infinite feed that pulls public images, displays user metadata, and updates interaction status instantly.
* *Example prompt:* `"Generate a scrollable Feed component that fetches the latest 20 posts. Each post card should render the author's avatar, username, the uploaded image, a caption, and placeholders for liking/commenting."`

### Step 7: Wire Up Interactions (Likes & Comments)
Make the feed dynamic by attaching interactive states to your UI elements.
* *Example prompt:* `"Implement real-time liking logic. When a user clicks the heart icon, conditionally toggle the database record and update the local UI state instantly."`

---

## 🤖 Prompts to Feed into Claude Code

Copy and paste these specific prompts sequentially into your active Claude Code session to generate your files:

### 1. Project Initialization & Tailwind Setup
> *"Configure Tailwind CSS in this project. Set up a standard mobile-first layout structure with a persistent bottom navigation bar containing links for Home, Search, Create, and Profile."*

### 2. Mock Data Generator (For Rapid Prototyping)
> *"Create a local mock data file containing 10 realistic Instagram posts with high-quality placeholder image URLs from Unsplash, sample captions, usernames, and avatar icons so we can build the UI without waiting on the backend."*

### 3. Creating the Instagram Feed Layout
> *"Build an elegant Instagram-style feed component using React and Tailwind CSS. The feed should map through our posts data. Make the image aspect ratio square, include a smooth double-tap gesture to like an image, and add an animated transition when the heart icon toggles."*

### 4. Setting up Profile & Grid Layouts
> *"Create a Profile page component. It should show a header with user stats (Posts, Followers, Following), a bio section, and a 3-column square grid of all the user's uploaded images, mimicking the native Instagram layout."*

---

## 📈 Scalability Considerations for Production
When moving from a Claude Code prototype to a production environment, you must eventually optimize:
1. **Image Optimization & CDN:** Raw mobile photos are too heavy. Use services like Cloudinary or Imgix to compress, crop, and cache images globally.
2. **Infinite Scroll Pagination:** Fetching thousands of images at once will crash the client. Implement cursor-based pagination (fetching 10-15 posts at a time as the user scrolls).
3. **Real-time Engine:** Use WebSockets or Supabase Realtime listeners to push new comments and likes instantly without manual page refreshes.