-- Foundation: media with rights, accounts, and the cross-cutting moderation tables.
-- Conventions for every migration:
--   * STRICT tables, foreign keys on, ids are TEXT (slugs for team content, random ids for user data).
--   * Timestamps are ISO-8601 UTC text. Money is integer minor units (paise).
--   * Booleans are INTEGER 0/1. Hindi text sits beside English as a _hi column.
--   * Publish gates (consent, verification) are CHECK constraints so no code path can skip them.

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','audio','video','panorama','document')),
  path TEXT NOT NULL,
  title TEXT,
  owner TEXT NOT NULL,
  permitted_use TEXT NOT NULL,
  licence_note TEXT NOT NULL DEFAULT '',
  license TEXT,
  license_url TEXT,
  source_url TEXT,
  contains_people INTEGER NOT NULL DEFAULT 0 CHECK (contains_people IN (0,1)),
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  privacy TEXT NOT NULL DEFAULT 'private' CHECK (privacy IN ('private','public')),
  lang TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','hi')),
  email TEXT,
  phone TEXT,
  avatar_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

-- Everyone is a visitor; the other roles are added on top.
CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('artisan','companion','moderator','admin')),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, role)
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE auth_attempts (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  until_epoch INTEGER NOT NULL
) STRICT;

-- One report table for posts, comments, hidden spots, companions, artisans and so on.
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','hidden_spot','artisan','companion','story','live_session','other')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  handled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  handled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (reporter_id, target_type, target_id)
) STRICT;
CREATE INDEX reports_open ON reports (status, created_at);

-- Append-only record of who approved, hid or verified what.
CREATE TABLE moderation_actions (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve','reject','hide','unhide','verify','suspend','restore')),
  by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  by_name TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX moderation_actions_target ON moderation_actions (target_type, target_id);
