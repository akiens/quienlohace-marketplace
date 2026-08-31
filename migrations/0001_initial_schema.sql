-- Esquema inicial de QuienLoHace.
--
-- Convenciones (D1 / SQLite):
--   * fechas  -> TEXT en ISO 8601 (no existe DATE nativo);
--   * booleanos -> INTEGER 0/1 (no existe BOOLEAN nativo);
--   * dinero/ids -> TEXT para ids estables y legibles.
--
-- La geografía NO vive acá: es Master Data del código (RF-108/119).
-- Los proveedores sólo guardan el `location_id` como referencia.

-- ---------------------------------------------------------------------------
-- Usuarios y sesiones
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  -- PBKDF2: "pbkdf2:iteraciones:salt:hash". NULL cuando la cuenta es sólo OAuth.
  password_hash TEXT,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'provider'
                CHECK (role IN ('provider', 'admin', 'superadmin')),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- El email se guarda normalizado en minúsculas; el índice único evita duplicados.
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
  -- Hash del token de sesión: si se filtra la base, las cookies no son reutilizables.
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------

CREATE TABLE providers (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'individual'
              CHECK (kind IN ('individual', 'business')),
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'work',

  category_id     TEXT NOT NULL,
  subcategory_id  TEXT NOT NULL,

  -- Referencias al Master Data geográfico que vive en el código.
  location_id TEXT NOT NULL,

  phone    TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',

  status TEXT NOT NULL DEFAULT 'draft'
         CHECK (status IN ('draft', 'active', 'pending_verification',
                           'suspended', 'inactive')),

  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),

  -- Calificación desnormalizada: se recalcula al crear/borrar una opinión,
  -- para no hacer un AVG por cada card del listado.
  rating_sum   INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_providers_slug ON providers (slug);
-- Un usuario administra un único perfil en el MVP.
CREATE UNIQUE INDEX idx_providers_user ON providers (user_id);
CREATE INDEX idx_providers_category ON providers (category_id, status);
CREATE INDEX idx_providers_subcategory ON providers (subcategory_id, status);
CREATE INDEX idx_providers_location ON providers (location_id, status);
-- Orden por defecto del listado: destacados primero, luego mejor puntuados.
CREATE INDEX idx_providers_ranking ON providers (status, featured DESC, review_count DESC);

-- Servicios que ofrece el proveedor (texto libre acotado por la UI).
CREATE TABLE provider_services (
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, name)
);

-- Zonas donde trabaja: distinto de dónde está ubicado (RF-028).
CREATE TABLE provider_service_areas (
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  PRIMARY KEY (provider_id, location_id)
);

CREATE INDEX idx_service_areas_location ON provider_service_areas (location_id);

CREATE TABLE provider_payment_methods (
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  method      TEXT NOT NULL
              CHECK (method IN ('Efectivo', 'Transferencia', 'Débito',
                                'Crédito', 'Otros')),
  PRIMARY KEY (provider_id, method)
);

-- Imágenes: el binario vive en R2, acá sólo la referencia (RF-012).
CREATE TABLE provider_images (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  alt         TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_provider_images_provider ON provider_images (provider_id, position);

-- ---------------------------------------------------------------------------
-- Opiniones
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'published'
              CHECK (status IN ('published', 'hidden', 'reported')),
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_reviews_provider ON reviews (provider_id, status, created_at DESC);
-- Una opinión por persona y proveedor: frena el spam trivial (RF-150).
CREATE UNIQUE INDEX idx_reviews_author_provider
  ON reviews (provider_id, author_id) WHERE author_id IS NOT NULL;
