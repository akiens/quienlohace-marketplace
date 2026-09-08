-- BR-032 / BR-033: disponibilidad por plan independiente de visibilidad.
ALTER TABLE profile_images ADD COLUMN gallery_state TEXT NOT NULL DEFAULT 'available'
  CHECK (gallery_state IN ('available', 'semi', 'frozen'));
ALTER TABLE profile_images ADD COLUMN owner_hidden INTEGER NOT NULL DEFAULT 0
  CHECK (owner_hidden IN (0, 1));
UPDATE profile_images SET owner_hidden = 1 WHERE hidden_reason = 'owner';
UPDATE profile_images SET gallery_state = 'frozen'
  WHERE kind = 'gallery' AND hidden_reason = 'plan';

CREATE TABLE profile_gallery_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_limit INTEGER,
  revision TEXT NOT NULL,
  selection_pending INTEGER NOT NULL DEFAULT 0 CHECK (selection_pending IN (0, 1)),
  retention_started_at TEXT
);
CREATE INDEX idx_gallery_retention ON profile_images(gallery_state, hidden_at)
  WHERE gallery_state <> 'available';

-- La eliminación de D1 y el encolado son atómicos; R2 se reintenta si falla.
CREATE TABLE media_deletion_queue (
  storage_key TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL
);
