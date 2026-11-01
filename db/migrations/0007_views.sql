-- Screen-shaped views, so each screen reads one row shape instead of repeating joins.
-- Views never decide what is visible in demo vs live mode: filter on status / is_sample / is_verified in the service.

-- Home, search results, place cards, map pins.
CREATE VIEW v_place_cards AS
SELECT
  p.id, p.slug, p.name, p.name_hi, p.category_id, c.name AS category_name, c.name_hi AS category_name_hi,
  p.lat, p.lng, p.summary, p.summary_hi, p.typical_visit_minutes,
  p.opening_hours_text, p.hours_checked_at, p.entry_fee_text, p.fee_checked_at,
  p.status, p.is_sample, m.path AS cover_path,
  (SELECT COUNT(*) FROM stories s WHERE s.place_id = p.id AND s.status = 'published') AS story_count,
  (SELECT COUNT(*) FROM artisan_places ap JOIN artisans a ON a.id = ap.artisan_id
    WHERE ap.place_id = p.id AND a.status = 'published') AS artisan_count
FROM places p
JOIN categories c ON c.id = p.category_id
LEFT JOIN media_assets m ON m.id = p.cover_media_id;

-- Story lists and the reader header: source line, who checked it, which languages and audio exist.
CREATE VIEW v_story_cards AS
SELECT
  s.id, s.place_id, pl.slug AS place_slug, pl.name AS place_name,
  s.title, s.title_hi, s.source_type, s.source_ref, s.author, s.told_by,
  s.verified_by, s.verified_at,
  (s.verified_by IS NOT NULL AND length(trim(s.verified_by)) > 0) AS is_verified,
  s.status, s.is_sample, s.updated_at,
  (SELECT group_concat(DISTINCT t.lang) FROM story_texts t WHERE t.story_id = s.id) AS langs,
  EXISTS (SELECT 1 FROM story_texts t WHERE t.story_id = s.id AND t.variant = 'simple' AND t.checked = 1) AS has_simple,
  EXISTS (SELECT 1 FROM story_audio a WHERE a.story_id = s.id) AS has_audio
FROM stories s
JOIN places pl ON pl.id = s.place_id;

-- Trails list: stop count and the ordered place ids (comma separated).
CREATE VIEW v_trail_overview AS
SELECT
  t.id, t.title, t.title_hi, t.theme, t.approx_minutes, t.status, t.is_sample,
  (SELECT COUNT(*) FROM trail_stops ts WHERE ts.trail_id = t.id) AS stop_count,
  (SELECT group_concat(place_id, ',') FROM (SELECT place_id FROM trail_stops WHERE trail_id = t.id ORDER BY position)) AS place_ids
FROM trails t;

-- Hidden Udaipur map: approved spots only; sensitive spots lose their exact coordinates.
CREATE VIEW v_hidden_spots_public AS
SELECT
  id, place_id, name, name_hi, description, why_it_matters, sensitive, area_label, moderated_by, moderated_at,
  CASE WHEN sensitive = 1 THEN NULL ELSE lat END AS lat,
  CASE WHEN sensitive = 1 THEN NULL ELSE lng END AS lng
FROM hidden_spots
WHERE status = 'approved';

-- Stays: the latest quote from each booking site, with the cheapest flagged (idea 15).
CREATE VIEW v_stay_price_comparison AS
WITH latest AS (
  SELECT sp.* FROM stay_prices sp
  WHERE sp.checked_at = (
    SELECT MAX(x.checked_at) FROM stay_prices x
    WHERE x.stay_id = sp.stay_id AND x.source_id = sp.source_id
      AND x.room_type IS sp.room_type AND x.for_date IS sp.for_date
  )
)
SELECT
  l.stay_id, l.room_type, l.for_date, l.source_id, bs.name AS source_name,
  l.price_minor, l.currency, l.url, l.checked_at,
  (l.price_minor = MIN(l.price_minor) OVER (PARTITION BY l.stay_id, l.room_type, l.for_date)) AS is_cheapest
FROM latest l
JOIN booking_sources bs ON bs.id = l.source_id
WHERE bs.is_active = 1;
