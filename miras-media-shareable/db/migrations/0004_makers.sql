-- C. Meet the makers and locals (ideas 17-22): artisans, voice onboarding, craft showcases,
-- workshops, enquiries, companions.

-- Idea 17. A maker is public only with consent, owner confirmation and no sample flag (DB-enforced gate).
CREATE TABLE artisans (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  craft TEXT NOT NULL,
  headline TEXT,
  description TEXT NOT NULL,
  description_hi TEXT,
  contact TEXT NOT NULL,
  locality_text TEXT NOT NULL,                      -- neighbourhood only, never a home address
  lat REAL CHECK (lat BETWEEN -90 AND 90),          -- neighbourhood centre for the map (idea 19)
  lng REAL CHECK (lng BETWEEN -180 AND 180),
  photo_rights TEXT NOT NULL,
  consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0,1)),
  consent_date TEXT,
  consent_doc_ref TEXT,
  owner_confirmed_at TEXT,
  edit_token_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK (status <> 'published' OR (is_sample = 0 AND consent_given = 1 AND consent_date IS NOT NULL AND owner_confirmed_at IS NOT NULL))
) STRICT;

CREATE TABLE artisan_languages (
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  PRIMARY KEY (artisan_id, language)
) STRICT;

CREATE TABLE artisan_materials (
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  PRIMARY KEY (artisan_id, material)
) STRICT;

CREATE TABLE artisan_media (
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'work' CHECK (kind IN ('portrait','hands','work','workshop')),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artisan_id, media_id)
) STRICT;

-- Place profiles list the local makers nearby.
CREATE TABLE artisan_places (
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  PRIMARY KEY (artisan_id, place_id)
) STRICT;

-- Idea 18. A spoken introduction becomes a draft; nothing goes live until the maker reviews it.
CREATE TABLE onboarding_drafts (
  id TEXT PRIMARY KEY,
  artisan_id TEXT REFERENCES artisans(id) ON DELETE SET NULL,
  audio_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  photo_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  spoken_lang TEXT,
  transcript TEXT,
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  uncertain_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(uncertain_fields_json)),
  provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock','gemini')),
  photo_shows_face INTEGER NOT NULL DEFAULT 0 CHECK (photo_shows_face IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','published','discarded')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

-- Idea 20. A short look at how a piece is made.
CREATE TABLE craft_showcases (
  id TEXT PRIMARY KEY,
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_hi TEXT,
  summary TEXT,
  tools TEXT,
  hours_estimate REAL CHECK (hours_estimate IS NULL OR hours_estimate > 0),
  cover_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  confirmed_by_owner_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (status <> 'published' OR confirmed_by_owner_at IS NOT NULL)
) STRICT;

CREATE TABLE craft_steps (
  showcase_id TEXT NOT NULL REFERENCES craft_showcases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  text_hi TEXT,
  media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  PRIMARY KEY (showcase_id, position)
) STRICT;

-- Idea 21. Hands-on sessions; dated sessions carry the seats so bookings (0006) can count them.
CREATE TABLE workshops (
  id TEXT PRIMARY KEY,
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_hi TEXT,
  description TEXT NOT NULL,
  language TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  cost_text TEXT NOT NULL,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  max_guests INTEGER CHECK (max_guests IS NULL OR max_guests > 0),
  how_to_book TEXT NOT NULL,
  cover_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  confirmed_by_owner_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (status <> 'published' OR confirmed_by_owner_at IS NOT NULL)
) STRICT;
CREATE INDEX workshops_artisan ON workshops (artisan_id);

CREATE TABLE workshop_sessions (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  seats_total INTEGER NOT NULL CHECK (seats_total > 0),
  seats_taken INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  CHECK (seats_taken <= seats_total)
) STRICT;
CREATE INDEX workshop_sessions_start ON workshop_sessions (workshop_id, starts_at);

-- Idea 17. Visitors send an enquiry; the maker replies directly (outside the app).
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  workshop_id TEXT REFERENCES workshops(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('question','appointment')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  contact_back TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX enquiries_artisan ON enquiries (artisan_id, created_at);

-- Idea 22. Rent a Friend. A companion is public only after identity check and safety-rules agreement.
CREATE TABLE companions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  bio_hi TEXT,
  area_label TEXT,
  photo_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  identity_verified_by TEXT,
  identity_verified_at TEXT,
  safety_rules_version TEXT,
  safety_agreed_at TEXT,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','suspended')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (status <> 'published' OR (identity_verified_by IS NOT NULL AND identity_verified_at IS NOT NULL AND safety_agreed_at IS NOT NULL))
) STRICT;

CREATE TABLE companion_languages (
  companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  PRIMARY KEY (companion_id, language)
) STRICT;

CREATE TABLE companion_experiences (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_hi TEXT,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  meeting_area_label TEXT,                          -- public meeting area, never a home address
  max_guests INTEGER NOT NULL DEFAULT 2 CHECK (max_guests > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'))
) STRICT;
CREATE INDEX companion_experiences_companion ON companion_experiences (companion_id);

CREATE TABLE companion_availability (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_booked INTEGER NOT NULL DEFAULT 0 CHECK (is_booked IN (0,1)),
  CHECK (ends_at > starts_at)
) STRICT;
CREATE INDEX companion_availability_slot ON companion_availability (companion_id, starts_at);
