-- Planes comerciales, identidad de clientes y reviews escribibles.
--
-- Cubre RF-050/053 (planes y límites), RF-123/125/175 (identidad de cliente
-- vía Google) y RF-144/154/176/180 (reviews con moderación).
--
-- Mismas convenciones que 0001: fechas ISO en TEXT, booleanos 0/1.

-- ---------------------------------------------------------------------------
-- Planes (RF-050, RF-051, RF-052, RF-053, RF-096)
-- ---------------------------------------------------------------------------

-- Los límites viven en la base, no en el código: RF-053 y RF-096 piden que
-- precios y topes se cambien sin desplegar. `plans` es la fuente de verdad.
CREATE TABLE plans (
  id       TEXT PRIMARY KEY CHECK (id IN ('cobre', 'gold', 'platinum')),
  name     TEXT NOT NULL,
  -- Centavos de USD: enteros, para no arrastrar errores de punto flotante.
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  period   TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month', 'year')),
  -- Orden de presentación y comparación de nivel: mayor = más capacidades.
  rank     INTEGER NOT NULL,

  -- Límites acumulativos. NULL significaría "sin límite"; hoy todos tienen tope.
  max_services      INTEGER NOT NULL,
  max_subcategories INTEGER NOT NULL,
  max_service_areas INTEGER NOT NULL,
  max_gallery_images INTEGER NOT NULL,
  max_team_members  INTEGER NOT NULL,

  -- Capacidades booleanas, para no hardcodear reglas por plan en la UI.
  allows_social_links   INTEGER NOT NULL DEFAULT 0 CHECK (allows_social_links IN (0, 1)),
  allows_landing        INTEGER NOT NULL DEFAULT 0 CHECK (allows_landing IN (0, 1)),
  allows_featured       INTEGER NOT NULL DEFAULT 0 CHECK (allows_featured IN (0, 1)),
  allows_contact_form   INTEGER NOT NULL DEFAULT 0 CHECK (allows_contact_form IN (0, 1)),
  allows_verification_request INTEGER NOT NULL DEFAULT 0
                        CHECK (allows_verification_request IN (0, 1)),
  -- basic | intermediate | full (RF-058).
  metrics_level TEXT NOT NULL DEFAULT 'basic'
                CHECK (metrics_level IN ('basic', 'intermediate', 'full')),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Valores iniciales de RF-050/051/052. Editables sin tocar el código.
INSERT INTO plans (
  id, name, price_cents, currency, period, rank,
  max_services, max_subcategories, max_service_areas, max_gallery_images,
  max_team_members, allows_social_links, allows_landing, allows_featured,
  allows_contact_form, allows_verification_request, metrics_level,
  created_at, updated_at
) VALUES
  ('cobre', 'Cobre', 0, 'USD', 'month', 1,
   5, 1, 5, 0, 0, 0, 0, 0, 0, 0, 'basic',
   '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
  ('gold', 'Gold', 500, 'USD', 'month', 2,
   15, 4, 15, 5, 0, 1, 0, 0, 0, 1, 'intermediate',
   '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
  ('platinum', 'Platinum', 2000, 'USD', 'month', 3,
   30, 8, 30, 20, 12, 1, 1, 1, 1, 1, 'full',
   '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');

-- Suscripción del proveedor. Se separa de `providers` porque tiene su propio
-- ciclo de vida (trial, vencimiento, cancelación) — RF-094.
-- Sin REFERENCES: SQLite no permite ADD COLUMN con clave foránea y default
-- no nulo a la vez. El CHECK cubre los valores válidos.
ALTER TABLE providers ADD COLUMN plan_id TEXT NOT NULL DEFAULT 'cobre'
  CHECK (plan_id IN ('cobre', 'gold', 'platinum'));

ALTER TABLE providers ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'
  CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired'));

-- Fin del trial/período pago. NULL en Cobre, que no vence.
ALTER TABLE providers ADD COLUMN plan_expires_at TEXT;

CREATE INDEX idx_providers_plan ON providers (plan_id, status);

-- ---------------------------------------------------------------------------
-- Campos de perfil que pedían los RF y no existían
-- ---------------------------------------------------------------------------

-- RF-013/169: el teléfono se guarda normalizado en E.164 y de ahí se derivan
-- el enlace de llamada y el de WhatsApp. `whatsapp_enabled` reemplaza guardar
-- el número dos veces.
ALTER TABLE providers ADD COLUMN phone_e164 TEXT NOT NULL DEFAULT '';
ALTER TABLE providers ADD COLUMN whatsapp_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (whatsapp_enabled IN (0, 1));
ALTER TABLE providers ADD COLUMN phone_public INTEGER NOT NULL DEFAULT 1
  CHECK (phone_public IN (0, 1));
ALTER TABLE providers ADD COLUMN public_email TEXT NOT NULL DEFAULT '';

-- RF-029: modalidad de atención.
ALTER TABLE providers ADD COLUMN service_mode TEXT NOT NULL DEFAULT 'on_site'
  CHECK (service_mode IN ('on_site', 'at_business', 'remote', 'hybrid'));

-- RF-166: identidad de la cuenta separada de la identidad pública.
ALTER TABLE providers ADD COLUMN logo_key TEXT NOT NULL DEFAULT '';
ALTER TABLE providers ADD COLUMN cover_key TEXT NOT NULL DEFAULT '';

-- RF-084: la verificación es un estado de confianza, no un beneficio del plan.
ALTER TABLE providers ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- RF-011/167: varias subcategorías según el plan. La `subcategory_id` de
-- `providers` sigue siendo la principal, para no romper búsquedas existentes.
CREATE TABLE provider_subcategories (
  provider_id    TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  subcategory_id TEXT NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, subcategory_id)
);

CREATE INDEX idx_provider_subcategories_sub
  ON provider_subcategories (subcategory_id);

-- RF-170: horarios estructurados por día, no un texto libre.
-- weekday 0 = domingo, 6 = sábado (igual que Date.getDay()).
CREATE TABLE provider_hours (
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  -- "HH:MM" en 24h. NULL cuando el día está cerrado o es 24 horas.
  opens_at    TEXT,
  closes_at   TEXT,
  closed      INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  open_24h    INTEGER NOT NULL DEFAULT 0 CHECK (open_24h IN (0, 1)),
  PRIMARY KEY (provider_id, weekday)
);

-- RF-013/171: redes sociales, sujetas al plan.
CREATE TABLE provider_social_links (
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  platform    TEXT NOT NULL
              CHECK (platform IN ('instagram', 'facebook', 'linkedin',
                                  'x', 'tiktok', 'youtube', 'website')),
  url         TEXT NOT NULL,
  PRIMARY KEY (provider_id, platform)
);

-- RF-016: integrantes del equipo (sólo Platinum).
CREATE TABLE provider_team_members (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  bio         TEXT NOT NULL DEFAULT '',
  photo_key   TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_provider_team_provider
  ON provider_team_members (provider_id, position);

-- ---------------------------------------------------------------------------
-- Clientes (RF-123, RF-125, RF-149, RF-175)
-- ---------------------------------------------------------------------------

-- Los clientes no tienen contraseña propia: la identidad la aporta Google.
-- Se guardan aparte de `users` porque no comparten ciclo de vida ni permisos:
-- un cliente nunca administra un perfil.
CREATE TABLE consumer_users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL DEFAULT 'google' CHECK (auth_provider IN ('google')),
  -- RF-175: el `sub` de Google es estable; el email puede cambiar.
  auth_provider_user_id TEXT NOT NULL,
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'suspended')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- RF-175: la identidad es (proveedor + id externo), no el email.
CREATE UNIQUE INDEX idx_consumer_provider_uid
  ON consumer_users (auth_provider, auth_provider_user_id);
CREATE INDEX idx_consumer_email ON consumer_users (email);

-- Sesiones de cliente, separadas de las de proveedor por el mismo motivo.
CREATE TABLE consumer_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES consumer_users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_consumer_sessions_user ON consumer_sessions (user_id);
CREATE INDEX idx_consumer_sessions_expires ON consumer_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Reviews escribibles (RF-146, RF-151, RF-176, RF-177)
-- ---------------------------------------------------------------------------

-- El autor pasa a ser un cliente, no un `users` (que son proveedores/admins).
ALTER TABLE reviews ADD COLUMN consumer_id TEXT REFERENCES consumer_users (id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN updated_at TEXT;

-- RF-177: una review por cliente y proveedor. Es un índice parcial porque las
-- reviews del seed no tienen autor y no deben chocar entre sí.
CREATE UNIQUE INDEX idx_reviews_consumer_provider
  ON reviews (provider_id, consumer_id) WHERE consumer_id IS NOT NULL;

-- RF-154: reportes de reviews. El reporte no borra: abre revisión.
CREATE TABLE review_reports (
  id          TEXT PRIMARY KEY,
  review_id   TEXT NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  -- Puede reportar un cliente identificado o un proveedor; ambos opcionales.
  consumer_id TEXT REFERENCES consumer_users (id) ON DELETE SET NULL,
  user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  reason      TEXT NOT NULL
              CHECK (reason IN ('spam', 'offensive', 'false_info',
                                'personal_info', 'conflict', 'other')),
  detail      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_review_reports_review ON review_reports (review_id, status);
