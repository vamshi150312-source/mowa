-- Mova schema. Ids are text so data imported from the old Node backend (e.g. "u-ava",
-- "p-1") keeps its ids; new rows get UUIDs.

create table users (
  id            text primary key,
  email         text not null unique,
  password_hash text not null,
  username      text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  full_name     text not null default '',
  bio           text not null default '' check (char_length(bio) <= 150),
  avatar_url    text not null default '',
  created_at    timestamptz not null default now()
);

create table sessions (
  token      text primary key,
  user_id    text not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);

create table posts (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  image_url  text not null,
  filter     text not null default 'none',
  music      text,
  caption    text not null default '' check (char_length(caption) <= 2200),
  -- Optional poll: {"question": "...", "options": ["...", "..."]}
  poll       jsonb,
  -- Publish time; in the future for a scheduled post.
  created_at timestamptz not null default now()
);
create index posts_created_idx on posts (created_at desc);
create index posts_user_idx on posts (user_id, created_at desc);

create table comments (
  id         text primary key,
  post_id    text not null references posts (id) on delete cascade,
  user_id    text not null references users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2200),
  created_at timestamptz not null default now()
);
create index comments_post_idx on comments (post_id, created_at);

create table reactions (
  post_id  text not null references posts (id) on delete cascade,
  user_id  text not null references users (id) on delete cascade,
  reaction text not null,
  primary key (post_id, user_id)
);

create table poll_votes (
  post_id text not null references posts (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  option  int  not null check (option >= 0),
  primary key (post_id, user_id)
);

create table follows (
  follower_id  text not null references users (id) on delete cascade,
  following_id text not null references users (id) on delete cascade,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on follows (following_id);

create table stories (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_url  text not null,
  filter     text not null default 'none',
  music      text,
  caption    text not null default '' check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index stories_live_idx on stories (expires_at, created_at);

create table story_views (
  story_id  text not null references stories (id) on delete cascade,
  user_id   text not null references users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  reaction  text,
  primary key (story_id, user_id)
);

create table messages (
  id         text primary key,
  from_id    text not null references users (id) on delete cascade,
  to_id      text not null references users (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 1000),
  -- A shared post. Not a foreign key: the message stays ("post unavailable") if the post goes.
  post_id    text,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  -- The recipient's reaction.
  reaction   text,
  -- Set on the record of a call (sent from the caller to the person called).
  call_kind         text check (call_kind in ('audio', 'video')),
  call_outcome      text check (call_outcome in ('completed', 'missed', 'declined')),
  call_duration_sec int
);
create index messages_from_idx on messages (from_id, created_at);
create index messages_to_idx on messages (to_id, created_at);

-- Small bits of app state, e.g. when the sample activity last ran.
create table app_state (
  key   text primary key,
  value text not null
);
