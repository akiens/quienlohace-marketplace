-- Cartas de servicio: ofertas concretas y publicables de un perfil.

ALTER TABLE plans ADD COLUMN max_service_cards INTEGER NOT NULL DEFAULT 2
  CHECK (max_service_cards >= 0);

UPDATE plans SET max_service_cards = CASE id
  WHEN 'cobre' THEN 2
  WHEN 'gold' THEN 10
  WHEN 'platinum' THEN 20
END;

CREATE TABLE service_cards (
  id                   TEXT PRIMARY KEY,
  profile_id           TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  specialty_id         TEXT NOT NULL,
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
  FOREIGN KEY (profile_id, specialty_id)
    REFERENCES profile_specialties (profile_id, specialty_id) ON DELETE CASCADE,
  CHECK (
    (price_kind = 'quote' AND price_min_cents IS NULL AND price_max_cents IS NULL)
    OR (price_kind IN ('fixed', 'from') AND price_min_cents IS NOT NULL AND price_max_cents IS NULL)
    OR (price_kind = 'range' AND price_min_cents IS NOT NULL AND price_max_cents IS NOT NULL
        AND price_max_cents >= price_min_cents)
  ),
  CHECK (duration_max_minutes IS NULL OR duration_min_minutes IS NULL
         OR duration_max_minutes >= duration_min_minutes)
);

CREATE UNIQUE INDEX idx_service_cards_slug ON service_cards (slug COLLATE NOCASE);
CREATE INDEX idx_service_cards_profile ON service_cards (profile_id, is_active, is_published, sort_order);
CREATE INDEX idx_service_cards_specialty ON service_cards (specialty_id, is_active, is_published);
