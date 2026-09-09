-- Las especialidades del perfil se reescriben al guardar. La carta debe
-- sobrevivir a esa operación para poder recuperarse si la especialidad vuelve.

CREATE TABLE service_cards_next (
  id                   TEXT PRIMARY KEY,
  profile_id           TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  specialty_id         TEXT NOT NULL REFERENCES specialties (id) ON DELETE RESTRICT,
  slug                 TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  price_kind           TEXT NOT NULL CHECK (price_kind IN ('quote', 'fixed', 'from', 'range')),
  price_min_cents      INTEGER CHECK (price_min_cents IS NULL OR price_min_cents >= 0),
  price_max_cents      INTEGER CHECK (price_max_cents IS NULL OR price_max_cents >= 0),
  currency             TEXT NOT NULL DEFAULT 'UYU' CHECK (currency = 'UYU'),
  tier                 TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('economy', 'standard', 'premium')),
  duration_min_minutes INTEGER CHECK (duration_min_minutes IS NULL OR duration_min_minutes > 0),
  duration_max_minutes INTEGER CHECK (duration_max_minutes IS NULL OR duration_max_minutes > 0),
  service_mode         TEXT NOT NULL CHECK (service_mode IN ('at_customer', 'at_business', 'remote')),
  payment_method       TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'debit_card', 'credit_card', 'other')),
  schedule             TEXT NOT NULL DEFAULT '',
  image_id             TEXT REFERENCES profile_images (id) ON DELETE SET NULL,
  is_published         INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order           INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  CHECK (
    (price_kind = 'quote' AND price_min_cents IS NULL AND price_max_cents IS NULL)
    OR (price_kind IN ('fixed', 'from') AND price_min_cents IS NOT NULL AND price_max_cents IS NULL)
    OR (price_kind = 'range' AND price_min_cents IS NOT NULL AND price_max_cents IS NOT NULL
        AND price_max_cents >= price_min_cents)
  ),
  CHECK (duration_max_minutes IS NULL OR duration_min_minutes IS NULL
         OR duration_max_minutes >= duration_min_minutes)
);

INSERT INTO service_cards_next
SELECT id, profile_id, specialty_id, slug, title, description, price_kind,
       price_min_cents, price_max_cents, currency, tier, duration_min_minutes,
       duration_max_minutes, service_mode, payment_method, schedule, image_id,
       is_published, is_active, sort_order, created_at, updated_at
  FROM service_cards;

DROP TABLE service_cards;
ALTER TABLE service_cards_next RENAME TO service_cards;

CREATE UNIQUE INDEX idx_service_cards_slug ON service_cards (slug COLLATE NOCASE);
CREATE INDEX idx_service_cards_profile ON service_cards (profile_id, is_active, is_published, sort_order);
CREATE INDEX idx_service_cards_specialty ON service_cards (specialty_id, is_active, is_published);
