-- Tables for the three features in "ABC(3 features)" (the MIRAS Groups prototype):
--   A. travel groups (itinerary, suggestions, chat, polls)
--   B. Local Friends with trust (verification, two-way reviews, tiers, reports, requests)
--   C. Udaipur events and workshops
-- Ids from the prototype are only unique inside a group, so child ids are stored prefixed ("g-food-trail:i1").
-- Local Friends are the fuller form of idea 22; the earlier `companions` tables stay for now and are not used by this data.

-- C. Events. The placeholder `events` table from 0003 was empty and unused; this shape fits events with no date
-- yet, ticket tiers and booking on the organiser's site. Rows come from public listings, so there is no
-- organiser-confirmation gate: `source_url` and `checked_on` say where and when each row was last checked.
DROP TABLE events;

CREATE TABLE event_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT,
  color TEXT
) STRICT;

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES event_categories(id),
  title TEXT NOT NULL,
  organiser TEXT NOT NULL,
  starts_at TEXT,                                   -- NULL until the dates are announced
  ends_at TEXT,
  expected_text TEXT,                               -- e.g. "Usually early February"
  recurring_text TEXT,                              -- e.g. "Twice a month · 5-8 PM"
  venue TEXT NOT NULL,
  nearest_place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  price_text TEXT NOT NULL,
  ticket_status TEXT NOT NULL CHECK (ticket_status IN ('on-sale','few-left','sold-out','free','at-venue','tba','past')),
  about TEXT NOT NULL,
  booking_url TEXT,
  booking_site TEXT,
  source_url TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  checked_on TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (ends_at IS NULL OR starts_at IS NOT NULL)
) STRICT;
CREATE INDEX events_starts ON events (starts_at);
CREATE INDEX events_category ON events (category_id);

CREATE TABLE event_tiers (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('on-sale','few-left','sold-out','free','at-venue','tba')),
  note TEXT,
  PRIMARY KEY (event_id, position)
) STRICT;

CREATE TABLE event_includes (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (event_id, position)
) STRICT;

-- "Tell me when tickets go live / dates are announced / the day before".
CREATE TABLE event_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('tickets','dates','day_before')),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, event_id, kind)
) STRICT;

CREATE TABLE event_attendance (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  going INTEGER NOT NULL DEFAULT 0 CHECK (going IN (0,1)),
  attended INTEGER NOT NULL DEFAULT 0 CHECK (attended IN (0,1)),
  PRIMARY KEY (user_id, event_id)
) STRICT;

-- Travellers (the prototype has no passwords; sample accounts get an unusable hash).
CREATE TABLE traveller_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city TEXT,
  travel_style TEXT,
  color TEXT,
  guest_rating REAL CHECK (guest_rating IS NULL OR guest_rating BETWEEN 1 AND 5),
  guest_review_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_review_count >= 0),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1))
) STRICT;

-- B. Local Friends. Paid only, at least Rs 100. Public only while DigiLocker verification is current.
CREATE TABLE local_friends (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  about TEXT NOT NULL,
  years_in_city INTEGER CHECK (years_in_city IS NULL OR years_in_city >= 0),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 10000),
  price_unit TEXT NOT NULL CHECK (price_unit IN ('half-day','day','trip')),
  rating REAL CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  hosted_count INTEGER NOT NULL DEFAULT 0 CHECK (hosted_count >= 0),
  response_rate REAL CHECK (response_rate IS NULL OR response_rate BETWEEN 0 AND 1),
  cancel_rate REAL CHECK (cancel_rate IS NULL OR cancel_rate BETWEEN 0 AND 1),
  last_trip_at TEXT,
  member_since TEXT,
  tier_current TEXT CHECK (tier_current IN ('new','trusted','top','legend')),   -- only when a tier has been recorded
  tier_since TEXT,
  tier_warning_to TEXT CHECK (tier_warning_to IN ('new','trusted','top','legend')),
  tier_warning_at TEXT,                                                          -- 30-day grace period starts here
  listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0,1)),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1))
) STRICT;

CREATE TABLE local_friend_languages (
  user_id TEXT NOT NULL REFERENCES local_friends(user_id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  PRIMARY KEY (user_id, language)
) STRICT;

CREATE TABLE local_friend_expertise (
  user_id TEXT NOT NULL REFERENCES local_friends(user_id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  PRIMARY KEY (user_id, topic)
) STRICT;

-- Only the verified flag, document type, masked id and date are kept; never the document itself.
CREATE TABLE local_verifications (
  user_id TEXT PRIMARY KEY REFERENCES local_friends(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  document TEXT NOT NULL,
  masked_id TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','pending','review','expired','suspended','withdrawn')),
  reason TEXT
) STRICT;

CREATE TABLE local_verification_history (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_friends(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL,
  by_name TEXT
) STRICT;
CREATE INDEX local_verification_history_user ON local_verification_history (user_id, at);

CREATE TABLE verification_appeals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES local_friends(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','rejected')),
  created_at TEXT NOT NULL
) STRICT;

-- A. Travel groups. Private groups join by invite code and leader approval; public groups join instantly.
CREATE TABLE travel_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('public','private')),
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  max_members INTEGER NOT NULL CHECK (max_members > 0),
  leader_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  solo INTEGER NOT NULL DEFAULT 0 CHECK (solo IN (0,1)),           -- a private trip space for a traveller and their local friend
  local_friend_id TEXT REFERENCES local_friends(user_id) ON DELETE SET NULL,
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
) STRICT;
CREATE INDEX travel_groups_type ON travel_groups (type, start_date);

CREATE TABLE group_vibes (
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  vibe TEXT NOT NULL,
  PRIMARY KEY (group_id, vibe)
) STRICT;

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT,
  PRIMARY KEY (group_id, user_id)
) STRICT;
CREATE INDEX group_members_user ON group_members (user_id);

CREATE TABLE group_join_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL,
  UNIQUE (group_id, user_id)
) STRICT;

CREATE TABLE group_itinerary_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day > 0),
  time TEXT NOT NULL CHECK (time GLOB '[0-2][0-9]:[0-5][0-9]'),
  title TEXT NOT NULL,
  place TEXT,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  note TEXT
) STRICT;
CREATE INDEX group_itinerary_group ON group_itinerary_items (group_id, day, time);

-- Members suggest an add / edit / remove; the leader accepts or rejects with a comment everyone can see.
CREATE TABLE group_suggestions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  by_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('add','edit','remove')),
  target_item_id TEXT REFERENCES group_itinerary_items(id) ON DELETE SET NULL,
  proposed_json TEXT CHECK (proposed_json IS NULL OR json_valid(proposed_json)),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  decision_comment TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (status = 'pending' OR (decision_comment IS NOT NULL AND decided_at IS NOT NULL))
) STRICT;
CREATE INDEX group_suggestions_group ON group_suggestions (group_id, status);

CREATE TABLE group_polls (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  by_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  multi INTEGER NOT NULL DEFAULT 0 CHECK (multi IN (0,1)),
  closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0,1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE group_poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES group_polls(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL
) STRICT;
CREATE INDEX group_poll_options_poll ON group_poll_options (poll_id, position);

CREATE TABLE group_poll_votes (
  option_id TEXT NOT NULL REFERENCES group_poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (option_id, user_id)
) STRICT;

-- Chat. A poll appears in the chat as a message that points at the poll; joins and decisions are system notes.
CREATE TABLE group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES travel_groups(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system','poll')),
  by_user TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT,
  poll_id TEXT REFERENCES group_polls(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  CHECK (kind <> 'text' OR (by_user IS NOT NULL AND body IS NOT NULL)),
  CHECK (kind <> 'system' OR body IS NOT NULL),
  CHECK (kind <> 'poll' OR poll_id IS NOT NULL)
) STRICT;
CREATE INDEX group_messages_group ON group_messages (group_id, created_at);

-- A traveller asks a Local Friend for a solo trip or for a group they lead; the local accepts or declines.
CREATE TABLE local_requests (
  id TEXT PRIMARY KEY,
  local_id TEXT NOT NULL REFERENCES local_friends(user_id) ON DELETE CASCADE,
  by_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES travel_groups(id) ON DELETE SET NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  reply TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  CHECK (end_date >= start_date)
) STRICT;
CREATE INDEX local_requests_local ON local_requests (local_id, status);

-- Two-way reviews. t2l = traveller rates the local (public on the local's profile);
-- l2t = local rates the traveller (visible to locals only). Blind until both sides review or the window closes.
CREATE TABLE trip_reviews (
  id TEXT PRIMARY KEY,
  trip_group_id TEXT REFERENCES travel_groups(id) ON DELETE SET NULL,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('t2l','l2t')),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  categories_json TEXT CHECK (categories_json IS NULL OR json_valid(categories_json)),
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  body TEXT,
  historic INTEGER NOT NULL DEFAULT 0 CHECK (historic IN (0,1)),   -- older reviews already counted in the profile totals
  trip_end TEXT,
  reply_text TEXT,
  reply_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (reply_text IS NULL OR reply_at IS NOT NULL)
) STRICT;
CREATE INDEX trip_reviews_to ON trip_reviews (to_user, direction, created_at);

-- Safety reports and auto-flags (low rating, low safety score, no-show) for the MIRAS admin console.
CREATE TABLE local_friend_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('safety','flag','no_show','other')),
  about_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  by_user TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed','dismissed')),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX local_friend_reports_about ON local_friend_reports (about_user, status);
