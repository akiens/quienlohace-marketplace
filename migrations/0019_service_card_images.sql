-- Imágenes propias de las cartas: una portada (la primera) y hasta tres
-- muestras. No consumen el cupo de galería del perfil.

CREATE TABLE service_card_images (
  id              TEXT PRIMARY KEY,
  service_card_id TEXT REFERENCES service_cards (id) ON DELETE CASCADE,
  profile_id      TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  owner_user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key     TEXT NOT NULL,
  alt             TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  lifecycle       TEXT NOT NULL DEFAULT 'pending'
                  CHECK (lifecycle IN ('pending', 'confirmed', 'discarded')),
  expires_at      TEXT,
  width           INTEGER NOT NULL DEFAULT 0 CHECK (width >= 0),
  height          INTEGER NOT NULL DEFAULT 0 CHECK (height >= 0),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_service_card_images_storage ON service_card_images (storage_key);
CREATE INDEX idx_service_card_images_card ON service_card_images (service_card_id, lifecycle, sort_order);
CREATE INDEX idx_service_card_images_pending ON service_card_images (owner_user_id, lifecycle, expires_at);
