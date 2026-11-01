# Database

SQLite, one file: `data/miras-v2.db`. Schema lives in `db/migrations/*.sql`, applied in order and recorded in `schema_migrations`.

**Status:** schema, importer and CSV templates are ready. Three screens in the app read this database today: **Find a stay** (`/discover/hotels`), **Bikes & cars** (`/discover/rentals`) and **Explore with a local** (`/discover/locals`), through `lib/services/city-services.ts`. Everything else (places, stories, trails, events, artisans) still reads the JSON in `content/` plus `data/miras.db` (the older JSON-blob and community tables). Switching `lib/repos` over is a separate step, done once your data is loaded.

**Demo vs live:** the three screens follow the same rule as stories. In demo mode they show the flagged sample rows (`npm run db:seed`) plus any real rows. In live mode (`NEXT_PUBLIC_DEMO_MODE=false`) a row appears only when it is `published` and a named person has verified it (`verified_at` set, or `identity_verified_at` for hosts). `data/` is git-ignored, so run `npm run db:seed` on a fresh checkout.

## Commands

| Command | What it does |
|---|---|
| `npm run db:migrate` | Create or upgrade `data/miras-v2.db` |
| `npm run db:status` | Row count per table |
| `npm run db:templates` | Rewrite blank CSVs in `db/csv-templates/` (one per table, header row only) |
| `npm run db:import -- <dir>` | Load `<table>.csv` files from `<dir>` |
| `npm run db:seed` | Load the flagged sample rows from `db/sample-data/sample.sql` (re-runnable) |
| `npm run db:import-abc` | Load `ABC(3 features)/src/mockData.js` + `eventsData.js` (travellers, Local Friends, groups, reviews, events) into migration 0008's tables (re-runnable) |

`MIRAS_DB=/path/to.db` points any command at another file.

## Giving data as CSV

1. Copy the templates you need from `db/csv-templates/` and fill them. `COLUMNS.txt` there lists every column, its type, and whether it is required.
2. Header names must match column names exactly. File name = table name (`places.csv` -> `places`).
3. Empty cell = the column default, else NULL. `yes`/`no`/`true`/`false` work in 0/1 columns.
4. Dates are ISO-8601 UTC (`2026-10-28T00:00:00Z`). Money is whole paise (Rs 2,000 = `200000`).
5. Lists are separate files, one row per item (`place_tips.csv`, `artisan_languages.csv`, `trail_stops.csv`), not comma-packed cells. Exception: `places.closed_days` is `sun,mon,...`.
6. File order does not matter; the importer loads parents first. The whole import is one transaction: a bad row aborts everything and names the file and line. Re-running updates rows with the same primary key.

Load these first, since most things point at them: `media_assets`, `categories`, `places`, `users`, `merchants`.

## Rules the database enforces

These are CHECK constraints, so no code path can skip them.

- A `history` story must have a `source_ref`; `verified_by` needs `verified_at`.
- An artisan can be `published` only with consent given, a consent date, `owner_confirmed_at`, and `is_sample = 0`.
- Workshops, craft showcases and events can be `published` only once the owner or organiser has confirmed.
- A companion can be `published` only after identity verification and agreeing to the safety rules.
- A hidden spot that is not `pending` needs a named moderator and a date.
- A merchant can be `active` only once verified. Seats taken cannot exceed seats total.
- One passport stamp per place and per trail per user.

## Ideas -> tables

| # | Idea | Tables |
|---|---|---|
| 1 | Story sources | `stories` (`source_type`, `source_ref`, `author`, `told_by`, `verified_*`, rights) |
| 2 | Places with honest details | `places` (hours/fee with `*_checked_at`), `place_tips`, `place_facts`, `place_photos`, `place_sources`, `categories` |
| 3 | Listen / read, EN + HI, simple | `story_texts` (lang x standard/simple), `story_audio` |
| 4-5 | Camera match and story | `place_recognition_refs`, `camera_matches` (never stores the visitor's photo) |
| 6 | AR history layer | `ar_overlays` |
| 7 | Trails and audio walks | `trails`, `trail_stops`, `trail_progress`, `passport_stamps` |
| 8 | Hidden Udaipur | `hidden_spots` (+ `v_hidden_spots_public` hides exact coordinates when `sensitive`) |
| 9-10 | 360 capture and viewer | `panoramas`, `panorama_hotspots` |
| 11 | Day planner | `day_plans`, `day_plan_stops` |
| 12 | Saved places | `saved_items` (place, story, artisan, trail, workshop, event, stay, rental, spot, companion) |
| 13 | Offline guides | `offline_packs`, `phrases` |
| 14 | Events | `events` |
| 15 | Stays and best price | `stays`, `stay_sustainability`, `booking_sources`, `stay_prices` (+ `v_stay_price_comparison`) |
| 16 | Rentals | `rental_shops`, `rental_offers` |
| 17 | Verified artisans | `artisans`, `artisan_languages`, `artisan_materials`, `artisan_media`, `artisan_places`, `enquiries` |
| 18 | Voice onboarding | `onboarding_drafts` |
| 19 | Artisans on the map | `artisans.lat/lng` (neighbourhood centre only) |
| 20 | Share your craft | `craft_showcases`, `craft_steps` |
| 21 | Workshops | `workshops`, `workshop_sessions` |
| 22 | Rent a Friend | `companions`, `companion_languages`, `companion_experiences`, `companion_availability`, `reports` |
| 23 | Memories | `memories`, `memory_moments`, `music_tracks` |
| 24 | Badges | `badge_definitions`, `user_badges` |
| 25 | Heritage passport | `passport_stamps` |
| 26 | Profiles | `users` (privacy), `user_badges.featured`, `journeys`, `journey_places` |
| 27 | Social layer | `follows`, `blocks`, `posts`, `post_media`, `post_likes`, `post_comments`, `post_shares`, `reports` |
| 28 | Live stories | `live_sessions`, `live_events`, `live_messages` |
| 29 | Website and QR | `qr_codes`, `qr_scans` (no visitor identifiers) |
| 30 | Bookings and payments | `merchants`, `bookings`, `payments`, `refunds` |

Shared: `media_assets` (rights on every file), `users`, `user_roles`, `sessions`, `moderation_actions`, `reports`. Full-text search for the search screen: `places_fts`, `stories_fts`, `story_texts_fts`, kept in sync by triggers.

## The "ABC (3 features)" prototype (migration 0008)

`ABC(3 features)/` is the MIRAS Groups prototype. Its data lives in these tables:

| Feature | Tables |
|---|---|
| A. Groups: itinerary, suggestions, chat, polls | `travel_groups`, `group_vibes`, `group_members`, `group_join_requests`, `group_itinerary_items`, `group_suggestions`, `group_polls`, `group_poll_options`, `group_poll_votes`, `group_messages` |
| B. Local Friends with trust | `traveller_profiles`, `local_friends` (fee, tier, rating), `local_friend_languages`, `local_friend_expertise`, `local_verifications` (+ `_history`), `verification_appeals`, `local_requests`, `trip_reviews` (blind two-way), `local_friend_reports` |
| C. Events and workshops | `events` (replaces the earlier empty one), `event_categories`, `event_tiers`, `event_includes`, `event_attendance`, `event_reminders` |

The travellers, groups and reviews are the prototype's demo data (`is_sample = 1`, accounts cannot sign in). Events are real listings collected on 1 Nov 2026 (`checked_on`, `source_url`), so they are not flagged as samples; re-check them before launch. Child ids are prefixed with their group (`g-food-trail:i1`). The importer stops with an error if the prototype ever gains a field it does not know, so nothing is dropped silently.

Local Friends overlap the earlier `companions` tables (idea 22). `/discover/locals` still reads `companions`; it should move to `local_friends`, and `companions` can then be dropped.

## Views for the screens

`v_place_cards` (home, search, map pins), `v_story_cards` (story lists and reader header: verified, languages, simple text, audio), `v_trail_overview`, `v_hidden_spots_public`, `v_stay_price_comparison`.

Views do not decide demo vs live visibility. Filter on `status`, `is_sample` and `is_verified` in the service, as `lib/services/content.ts` does today.

## Conventions

- Ids are TEXT: slugs for team content (`pichhola`), random ids for user data.
- Bilingual text is a `_hi` column beside the English one. Story bodies are rows in `story_texts`.
- Money is integer paise. Booleans are 0/1. Every table is STRICT.
- Payments keep only the provider's reference, never card data.

## Not done yet

- Apart from stays, rentals and local hosts, `lib/repos` and the services still read JSON and `data/miras.db`. Moving them onto this schema, and copying existing community accounts and posts across, is the next step.
- Local hosts show availability and experiences, but requesting a time, booking and reporting a host need visitor accounts on this database plus the bookings flow (idea 30). Rentals are by phone call.
- Other ideas in A, B and C that have no screen yet: artisans on a map (19), share-your-craft showcases (20), the 360 capture app (9) and the AR layer (6, concept page only).
- `artisans.edit_token_hash` stores a hash; the live app stores the raw token. The owner-link flow must hash on write when it is switched over.
- Payment provider, refund policy and companion safety rules are schema only; the product decisions behind them are open.
