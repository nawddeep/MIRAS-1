-- D. Remember and share (ideas 23-28): memories, badges, passport, journeys, the social layer, live stories.

-- Idea 23. A highlight reel from the visitor's own photos. The visitor owns it and can delete it (cascades).
CREATE TABLE music_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  owner TEXT NOT NULL,
  permitted_use TEXT NOT NULL,
  licence_note TEXT NOT NULL
) STRICT;

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  day TEXT,
  music_track_id TEXT REFERENCES music_tracks(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','followers','public')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX memories_user ON memories (user_id, created_at);

CREATE TABLE memory_moments (
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  caption TEXT CHECK (caption IS NULL OR length(caption) <= 200),
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  face_visible INTEGER NOT NULL DEFAULT 0 CHECK (face_visible IN (0,1)),
  face_blurred INTEGER NOT NULL DEFAULT 0 CHECK (face_blurred IN (0,1)),
  uncertain INTEGER NOT NULL DEFAULT 0 CHECK (uncertain IN (0,1)),
  PRIMARY KEY (memory_id, position)
) STRICT;

-- Idea 24. Badges are definitions; the metric names what is counted.
CREATE TABLE badge_definitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_hi TEXT,
  description TEXT NOT NULL,
  metric TEXT NOT NULL,                             -- completed_trips, completed_trails, artisan_visits, published_memories, ...
  threshold INTEGER NOT NULL CHECK (threshold > 0),
  icon_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL
) STRICT;

CREATE TABLE user_badges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),   -- idea 26: shown on the profile
  PRIMARY KEY (user_id, badge_id)
) STRICT;

-- Idea 25. Heritage passport: one stamp per place read or trail walked. No leaderboard.
CREATE TABLE passport_stamps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('place','trail')),
  place_id TEXT REFERENCES places(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES trails(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('camera','gps','audio_walk','manual')),
  stamped_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK ((kind = 'place' AND place_id IS NOT NULL AND trail_id IS NULL)
      OR (kind = 'trail' AND trail_id IS NOT NULL AND place_id IS NULL))
) STRICT;
CREATE UNIQUE INDEX passport_place_once ON passport_stamps (user_id, place_id) WHERE kind = 'place';
CREATE UNIQUE INDEX passport_trail_once ON passport_stamps (user_id, trail_id) WHERE kind = 'trail';

-- Idea 7. Where a visitor is on a trail.
CREATE TABLE trail_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  last_stop_position INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, trail_id)
) STRICT;

-- Idea 26. A day's journey shown on the profile.
CREATE TABLE journeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  trail_id TEXT REFERENCES trails(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (user_id, day)
) STRICT;

CREATE TABLE journey_places (
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  place_id TEXT NOT NULL REFERENCES places(id),
  PRIMARY KEY (journey_id, position)
) STRICT;

-- Idea 27. Social layer.
CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'accepted' CHECK (state IN ('pending','accepted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (follower_id, target_id),
  CHECK (follower_id <> target_id)
) STRICT;
CREATE INDEX follows_target ON follows (target_id);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (blocker_id, target_id),
  CHECK (blocker_id <> target_id)
) STRICT;

-- A post can point at a place, a memory, or the hidden spot it suggests (suggestions feed idea 8).
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','photo','story','memory','suggestion')),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'followers' CHECK (visibility IN ('private','followers','public')),
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  hidden_spot_id TEXT REFERENCES hidden_spots(id) ON DELETE SET NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX posts_feed ON posts (created_at DESC, id);
CREATE INDEX posts_author ON posts (author_id, created_at);

CREATE TABLE post_media (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id)
) STRICT;

CREATE TABLE post_likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, post_id)
) STRICT;

CREATE TABLE post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX post_comments_post ON post_comments (post_id, created_at);

CREATE TABLE post_shares (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'link' CHECK (channel IN ('link','whatsapp','instagram','repost','other')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

-- Idea 28. Friends watch a trip as it happens.
CREATE TABLE live_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  trail_id TEXT REFERENCES trails(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'followers' CHECK (visibility IN ('private','followers','public')),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ended_at TEXT
) STRICT;
CREATE INDEX live_sessions_active ON live_sessions (user_id, started_at);

CREATE TABLE live_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('place','story','memory','post','note')),
  ref_id TEXT,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX live_events_session ON live_events (session_id, id);

CREATE TABLE live_messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX live_messages_session ON live_messages (session_id, id);
