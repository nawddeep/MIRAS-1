-- A. Discover the city (ideas 1-10): places, sourced stories, audio, trails, hidden spots,
-- camera matching, AR overlays, 360 panoramas.

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_hi TEXT,
  position INTEGER NOT NULL DEFAULT 0
) STRICT;

-- Idea 2. Hours and fees carry the date they were last checked; NULL means "not checked", never a guess.
CREATE TABLE places (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL,
  name_hi TEXT,
  category_id TEXT NOT NULL REFERENCES categories(id),
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  summary TEXT NOT NULL,
  summary_hi TEXT,
  typical_visit_minutes INTEGER NOT NULL CHECK (typical_visit_minutes > 0),
  opening_hours_text TEXT NOT NULL,
  open_time TEXT CHECK (open_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  close_time TEXT CHECK (close_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  closed_days TEXT NOT NULL DEFAULT '',            -- comma list: sun,mon,...
  hours_checked_at TEXT,
  hours_checked_by TEXT,
  entry_fee_text TEXT,
  fee_checked_at TEXT,
  fee_checked_by TEXT,
  step_free TEXT NOT NULL DEFAULT 'unknown' CHECK (step_free IN ('yes','no','unknown')),
  accessibility_notes TEXT,
  cover_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  coordinate_note TEXT,
  coordinate_source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK ((open_time IS NULL) = (close_time IS NULL)),
  CHECK (hours_checked_by IS NULL OR hours_checked_at IS NOT NULL),
  CHECK (fee_checked_by IS NULL OR fee_checked_at IS NOT NULL)
) STRICT;
CREATE INDEX places_category ON places (category_id);

CREATE TABLE place_tips (
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  text_hi TEXT,
  PRIMARY KEY (place_id, position)
) STRICT;

-- Etiquette, conservation, photography and accessibility notes, each with who checked it.
CREATE TABLE place_facts (
  id INTEGER PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('etiquette','conservation','photography','accessibility','safety')),
  text TEXT NOT NULL,
  text_hi TEXT,
  verified_by TEXT,
  verified_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;
CREATE INDEX place_facts_place ON place_facts (place_id, kind);

CREATE TABLE place_photos (
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (place_id, media_id)
) STRICT;

CREATE TABLE place_sources (
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  PRIMARY KEY (place_id, url)
) STRICT;

-- Idea 1. Every story carries its source: type, reference, author, who told it, who checked it.
CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_hi TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('history','oral_tradition','legend')),
  source_ref TEXT,
  author TEXT,
  told_by TEXT,                                    -- oral traditions name the person who told them
  rights_owner TEXT NOT NULL,
  rights_permitted_use TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (source_type <> 'history' OR length(trim(coalesce(source_ref,''))) > 0),
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;
CREATE INDEX stories_place ON stories (place_id);

-- Idea 3. One row per language and reading level: English/Hindi, standard/simple.
CREATE TABLE story_texts (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('en','hi')),
  variant TEXT NOT NULL DEFAULT 'standard' CHECK (variant IN ('standard','simple')),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0,1)),
  checked_by TEXT,
  checked_at TEXT,
  PRIMARY KEY (story_id, lang, variant),
  CHECK (checked = 0 OR checked_at IS NOT NULL)
) STRICT;

CREATE TABLE story_audio (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'standard',
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  voice TEXT NOT NULL CHECK (voice IN ('human','synthetic')),
  narrator TEXT,
  UNIQUE (story_id, lang, variant),
  FOREIGN KEY (story_id, lang, variant) REFERENCES story_texts(story_id, lang, variant) ON DELETE CASCADE
) STRICT;

-- Phrase help for offline guides.
CREATE TABLE phrases (
  id TEXT PRIMARY KEY,
  en TEXT NOT NULL,
  hi TEXT NOT NULL,
  transliteration TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1))
) STRICT;

-- Idea 7. Ordered walking route; a stop may start an audio story on arrival.
CREATE TABLE trails (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_hi TEXT,
  theme TEXT NOT NULL,
  approx_minutes INTEGER NOT NULL CHECK (approx_minutes > 0),
  stamp_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

CREATE TABLE trail_stops (
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  place_id TEXT NOT NULL REFERENCES places(id),
  audio_story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
  arrive_radius_m INTEGER NOT NULL DEFAULT 50 CHECK (arrive_radius_m > 0),
  note TEXT,
  PRIMARY KEY (trail_id, position)
) STRICT;
CREATE INDEX trail_stops_place ON trail_stops (place_id);

-- Idea 8. Visitor and local suggestions plus team-curated spots. Public only once a named person approves.
-- sensitive = 1 keeps the exact location private; v_hidden_spots_public shows only area_label for those.
CREATE TABLE hidden_spots (
  id TEXT PRIMARY KEY,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_hi TEXT,
  description TEXT NOT NULL,
  why_it_matters TEXT NOT NULL DEFAULT '',
  note TEXT,
  sensitive INTEGER NOT NULL DEFAULT 0 CHECK (sensitive IN (0,1)),
  lat REAL CHECK (lat BETWEEN -90 AND 90),
  lng REAL CHECK (lng BETWEEN -180 AND 180),
  area_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sourced_by TEXT,
  moderated_by TEXT,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK (status = 'pending' OR (moderated_by IS NOT NULL AND moderated_at IS NOT NULL))
) STRICT;
CREATE INDEX hidden_spots_status ON hidden_spots (status);

-- Ideas 4 and 5. Reference images used to recognise a place, and a log of every match shown.
-- The visitor's own photo is never stored here.
CREATE TABLE place_recognition_refs (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  description TEXT
) STRICT;

CREATE TABLE camera_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  band TEXT NOT NULL CHECK (band IN ('high','medium','unsure')),
  person_is_main_subject INTEGER NOT NULL DEFAULT 0 CHECK (person_is_main_subject IN (0,1)),
  model TEXT,
  accepted INTEGER CHECK (accepted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX camera_matches_user ON camera_matches (user_id, created_at);

-- Idea 6. History layer drawn over a monument.
CREATE TABLE ar_overlays (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_hi TEXT,
  description TEXT,
  era_label TEXT,
  media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  anchor_json TEXT CHECK (anchor_json IS NULL OR json_valid(anchor_json)),
  verified_by TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 1 CHECK (is_sample IN (0,1)),
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;

-- Ideas 9 and 10. 360 photos captured on iPhone, viewed on the web, with hotspots to stories.
CREATE TABLE panoramas (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  captured_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  captured_at TEXT,
  device TEXT,
  heading_deg REAL CHECK (heading_deg IS NULL OR heading_deg >= 0 AND heading_deg < 360),
  is_preview INTEGER NOT NULL DEFAULT 0 CHECK (is_preview IN (0,1)),
  illustrative INTEGER NOT NULL DEFAULT 0 CHECK (illustrative IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX panoramas_place ON panoramas (place_id);

CREATE TABLE panorama_hotspots (
  id TEXT PRIMARY KEY,
  panorama_id TEXT NOT NULL REFERENCES panoramas(id) ON DELETE CASCADE,
  yaw REAL NOT NULL,
  pitch REAL NOT NULL,
  label TEXT NOT NULL,
  label_hi TEXT,
  story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  CHECK (story_id IS NOT NULL OR place_id IS NOT NULL)
) STRICT;
CREATE INDEX panorama_hotspots_pano ON panorama_hotspots (panorama_id);

-- Search screen: full-text indexes kept in sync by triggers.
CREATE VIRTUAL TABLE places_fts USING fts5(name, name_hi, summary, summary_hi, content='places', content_rowid='rowid');
CREATE TRIGGER places_fts_ai AFTER INSERT ON places BEGIN
  INSERT INTO places_fts(rowid, name, name_hi, summary, summary_hi) VALUES (new.rowid, new.name, new.name_hi, new.summary, new.summary_hi);
END;
CREATE TRIGGER places_fts_ad AFTER DELETE ON places BEGIN
  INSERT INTO places_fts(places_fts, rowid, name, name_hi, summary, summary_hi) VALUES ('delete', old.rowid, old.name, old.name_hi, old.summary, old.summary_hi);
END;
CREATE TRIGGER places_fts_au AFTER UPDATE ON places BEGIN
  INSERT INTO places_fts(places_fts, rowid, name, name_hi, summary, summary_hi) VALUES ('delete', old.rowid, old.name, old.name_hi, old.summary, old.summary_hi);
  INSERT INTO places_fts(rowid, name, name_hi, summary, summary_hi) VALUES (new.rowid, new.name, new.name_hi, new.summary, new.summary_hi);
END;

CREATE VIRTUAL TABLE stories_fts USING fts5(title, title_hi, content='stories', content_rowid='rowid');
CREATE TRIGGER stories_fts_ai AFTER INSERT ON stories BEGIN
  INSERT INTO stories_fts(rowid, title, title_hi) VALUES (new.rowid, new.title, new.title_hi);
END;
CREATE TRIGGER stories_fts_ad AFTER DELETE ON stories BEGIN
  INSERT INTO stories_fts(stories_fts, rowid, title, title_hi) VALUES ('delete', old.rowid, old.title, old.title_hi);
END;
CREATE TRIGGER stories_fts_au AFTER UPDATE ON stories BEGIN
  INSERT INTO stories_fts(stories_fts, rowid, title, title_hi) VALUES ('delete', old.rowid, old.title, old.title_hi);
  INSERT INTO stories_fts(rowid, title, title_hi) VALUES (new.rowid, new.title, new.title_hi);
END;

CREATE VIRTUAL TABLE story_texts_fts USING fts5(body, content='story_texts', content_rowid='rowid');
CREATE TRIGGER story_texts_fts_ai AFTER INSERT ON story_texts BEGIN
  INSERT INTO story_texts_fts(rowid, body) VALUES (new.rowid, new.body);
END;
CREATE TRIGGER story_texts_fts_ad AFTER DELETE ON story_texts BEGIN
  INSERT INTO story_texts_fts(story_texts_fts, rowid, body) VALUES ('delete', old.rowid, old.body);
END;
CREATE TRIGGER story_texts_fts_au AFTER UPDATE ON story_texts BEGIN
  INSERT INTO story_texts_fts(story_texts_fts, rowid, body) VALUES ('delete', old.rowid, old.body);
  INSERT INTO story_texts_fts(rowid, body) VALUES (new.rowid, new.body);
END;
