-- E. Reach and growth (ideas 29-30): QR entry points, verified merchants, bookings, payments, refunds.

-- Idea 29. One scan to start. Scans keep no visitor identifiers.
CREATE TABLE qr_codes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  target_path TEXT NOT NULL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;

CREATE TABLE qr_scans (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL REFERENCES qr_codes(code) ON DELETE CASCADE,
  scanned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX qr_scans_code ON qr_scans (code, scanned_at);

-- Idea 30. Only a verified local business can take bookings.
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('stay','rental','artisan','companion','organiser','other')),
  name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  payout_provider TEXT,
  payout_ref TEXT,
  verified_by TEXT,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (status <> 'active' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
) STRICT;

-- item_type + item_id point at the thing booked; the merchant is stored so a booking survives edits to it.
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('workshop_session','stay','rental_offer','companion_experience','event')),
  item_id TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  contact TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','paid','cancelled','refunded','completed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
) STRICT;
CREATE INDEX bookings_user ON bookings (user_id, created_at);
CREATE INDEX bookings_merchant ON bookings (merchant_id, status);

-- Payments go through a licensed provider; only its reference is kept here, never card data.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','authorised','captured','failed','partially_refunded','refunded')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (provider, provider_ref)
) STRICT;
CREATE INDEX payments_booking ON payments (booking_id);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','processed')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  processed_at TEXT
) STRICT;
CREATE INDEX refunds_payment ON refunds (payment_id);
