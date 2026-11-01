-- Sample rows so the stays, rentals and local-host screens are not empty in demo mode.
-- Every row is is_sample = 1 with generic "SAMPLE:" text and no real facts: the app shows them only in demo
-- mode, with a Sample badge, and hides them in live mode. Prices are placeholders, not real quotes.
-- Safe to run repeatedly (npm run db:seed). Real data goes in through CSV imports.

-- Stays (idea 15)
INSERT OR REPLACE INTO booking_sources (id, name) VALUES
  ('sample-site-a', 'SAMPLE: Booking site A'),
  ('sample-site-b', 'SAMPLE: Booking site B'),
  ('sample-site-c', 'SAMPLE: Booking site C');

INSERT OR REPLACE INTO stays (id, name, kind, description, lat, lng, area, phone, sustainable, sustainability_notes, status, is_sample) VALUES
  ('sample-stay-1', 'SAMPLE: Lakeside heritage stay', 'heritage_haveli', 'SAMPLE: description goes here.', 24.5790, 73.6790, 'SAMPLE: area goes here', 'SAMPLE: phone goes here', 1, 'SAMPLE: sustainability notes go here', 'draft', 1),
  ('sample-stay-2', 'SAMPLE: Old city guesthouse', 'guesthouse', 'SAMPLE: description goes here.', 24.5830, 73.6830, 'SAMPLE: area goes here', 'SAMPLE: phone goes here', 0, NULL, 'draft', 1),
  ('sample-stay-3', 'SAMPLE: Hillside homestay', 'homestay', 'SAMPLE: description goes here.', 24.5920, 73.7050, 'SAMPLE: area goes here', 'SAMPLE: phone goes here', 1, 'SAMPLE: sustainability notes go here', 'draft', 1);

INSERT OR REPLACE INTO stay_sustainability (stay_id, practice) VALUES
  ('sample-stay-1', 'SAMPLE: practice goes here'),
  ('sample-stay-3', 'SAMPLE: practice goes here');

INSERT OR REPLACE INTO stay_prices (id, stay_id, source_id, room_type, price_minor, checked_at) VALUES
  (9001, 'sample-stay-1', 'sample-site-a', 'Double room', 250000, '2026-10-30T00:00:00Z'),
  (9002, 'sample-stay-1', 'sample-site-b', 'Double room', 200000, '2026-10-30T00:00:00Z'),
  (9003, 'sample-stay-1', 'sample-site-c', 'Double room', 230000, '2026-10-30T00:00:00Z'),
  (9004, 'sample-stay-2', 'sample-site-a', 'Double room',  90000, '2026-10-30T00:00:00Z'),
  (9005, 'sample-stay-2', 'sample-site-b', 'Double room', 110000, '2026-10-30T00:00:00Z'),
  (9006, 'sample-stay-3', 'sample-site-a', 'Double room', 150000, '2026-10-30T00:00:00Z'),
  (9007, 'sample-stay-3', 'sample-site-c', 'Double room', 140000, '2026-10-30T00:00:00Z');

-- Rentals (idea 16)
INSERT OR REPLACE INTO rental_shops (id, name, lat, lng, area, phone, hours_text, status, is_sample) VALUES
  ('sample-rental-1', 'SAMPLE: Bike and scooter shop', 24.5760, 73.6850, 'SAMPLE: area goes here', 'SAMPLE: phone goes here', 'SAMPLE: hours go here', 'draft', 1),
  ('sample-rental-2', 'SAMPLE: Car rental desk', 24.5880, 73.7000, 'SAMPLE: area goes here', 'SAMPLE: phone goes here', 'SAMPLE: hours go here', 'draft', 1);

INSERT OR REPLACE INTO rental_offers (id, shop_id, vehicle_kind, model, price_minor, per, deposit_minor, notes) VALUES
  ('sample-offer-1', 'sample-rental-1', 'cycle',   'SAMPLE: model',  15000, 'day', NULL,   NULL),
  ('sample-offer-2', 'sample-rental-1', 'scooter', 'SAMPLE: model',  50000, 'day', 200000, NULL),
  ('sample-offer-3', 'sample-rental-1', 'bike',    'SAMPLE: model',  70000, 'day', 300000, NULL),
  ('sample-offer-4', 'sample-rental-2', 'car',     'SAMPLE: model', 250000, 'day', 500000, NULL);

-- Local companions (idea 22). Sample accounts cannot sign in: their password hash is not a valid hash.
INSERT OR REPLACE INTO users (id, username, display_name, password_hash, recovery_hash) VALUES
  ('sample-user-1', 'sample-host-1', 'SAMPLE: Host name', '!sample-no-login', '!sample-no-login'),
  ('sample-user-2', 'sample-host-2', 'SAMPLE: Host name', '!sample-no-login', '!sample-no-login');

INSERT OR REPLACE INTO companions (id, user_id, display_name, bio, area_label, status, is_sample) VALUES
  ('sample-companion-1', 'sample-user-1', 'SAMPLE: Host name', 'SAMPLE: a short introduction goes here.', 'SAMPLE: area goes here', 'draft', 1),
  ('sample-companion-2', 'sample-user-2', 'SAMPLE: Host name', 'SAMPLE: a short introduction goes here.', 'SAMPLE: area goes here', 'draft', 1);

INSERT OR REPLACE INTO companion_languages (companion_id, language) VALUES
  ('sample-companion-1', 'Hindi'), ('sample-companion-1', 'English'),
  ('sample-companion-2', 'Hindi');

INSERT OR REPLACE INTO companion_experiences (id, companion_id, title, description, duration_minutes, price_minor, meeting_area_label, max_guests, status) VALUES
  ('sample-exp-1', 'sample-companion-1', 'SAMPLE: neighbourhood walk', 'SAMPLE: what to expect goes here.', 120, 80000, 'SAMPLE: public meeting point', 4, 'published'),
  ('sample-exp-2', 'sample-companion-2', 'SAMPLE: tea and stories', 'SAMPLE: what to expect goes here.', 90, 50000, 'SAMPLE: public meeting point', 2, 'published');

INSERT OR REPLACE INTO companion_availability (id, companion_id, starts_at, ends_at) VALUES
  ('sample-slot-1', 'sample-companion-1', '2027-01-20T04:30:00Z', '2027-01-20T06:30:00Z'),
  ('sample-slot-2', 'sample-companion-1', '2027-01-21T04:30:00Z', '2027-01-21T06:30:00Z'),
  ('sample-slot-3', 'sample-companion-2', '2027-01-22T10:30:00Z', '2027-01-22T12:00:00Z');
