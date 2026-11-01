-- B. Plan the trip (ideas 11-16): events, day planner, saved places, offline guides,
-- stays with price comparison, rentals. Bookable merchants are defined in 0006.

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_hi TEXT,
  organiser TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  language TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  cost_text TEXT NOT NULL,
  how_to_book TEXT NOT NULL,
  nearest_place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  confirmed_by_organiser_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (status <> 'published' OR confirmed_by_organiser_at IS NOT NULL)
) STRICT;
CREATE INDEX events_starts ON events (starts_at);

-- Idea 11.
CREATE TABLE day_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  plan_date TEXT,
  start_time TEXT NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  hours REAL NOT NULL CHECK (hours > 0),
  mode TEXT NOT NULL CHECK (mode IN ('walk','drive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX day_plans_user ON day_plans (user_id, updated_at);

CREATE TABLE day_plan_stops (
  plan_id TEXT NOT NULL REFERENCES day_plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  place_id TEXT NOT NULL REFERENCES places(id),
  minutes_override INTEGER CHECK (minutes_override IS NULL OR minutes_override > 0),
  PRIMARY KEY (plan_id, position)
) STRICT;

-- Idea 12. One shortlist for every kind of thing a visitor can save.
CREATE TABLE saved_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('place','story','artisan','trail','workshop','event','stay','rental_shop','hidden_spot','companion')),
  item_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, item_type, item_id)
) STRICT;

-- Idea 13. What an offline guide contains; the device downloads the manifest's files.
CREATE TABLE offline_packs (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('city','place','trail')),
  scope_id TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (scope_type, scope_id)
) STRICT;

-- Idea 15. Same stay, price per booking site.
CREATE TABLE booking_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
) STRICT;

CREATE TABLE stays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_hi TEXT,
  kind TEXT NOT NULL DEFAULT 'hotel' CHECK (kind IN ('hotel','hostel','homestay','guesthouse','heritage_haveli','other')),
  description TEXT,
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  area TEXT,
  address TEXT,
  phone TEXT,
  nearest_place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  cover_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  sustainable INTEGER NOT NULL DEFAULT 0 CHECK (sustainable IN (0,1)),
  sustainability_notes TEXT,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,   -- set when the stay takes bookings in-app (see 0006)
  verified_by TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;

-- Which sustainable practices a stay follows, each checked by a named person.
CREATE TABLE stay_sustainability (
  stay_id TEXT NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  practice TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  PRIMARY KEY (stay_id, practice),
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;

CREATE TABLE stay_prices (
  id INTEGER PRIMARY KEY,
  stay_id TEXT NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES booking_sources(id),
  room_type TEXT,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  for_date TEXT,
  url TEXT,
  checked_at TEXT NOT NULL
) STRICT;
CREATE INDEX stay_prices_latest ON stay_prices (stay_id, source_id, checked_at DESC);

-- Idea 16. Rental shops near the visitor with a call button.
CREATE TABLE rental_shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_hi TEXT,
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  area TEXT,
  phone TEXT NOT NULL,
  hours_text TEXT,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,
  verified_by TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
) STRICT;

CREATE TABLE rental_offers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  vehicle_kind TEXT NOT NULL CHECK (vehicle_kind IN ('cycle','bike','scooter','car')),
  model TEXT,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  per TEXT NOT NULL DEFAULT 'day' CHECK (per IN ('hour','day')),
  deposit_minor INTEGER CHECK (deposit_minor IS NULL OR deposit_minor >= 0),
  notes TEXT,
  checked_at TEXT
) STRICT;
CREATE INDEX rental_offers_shop ON rental_offers (shop_id);
