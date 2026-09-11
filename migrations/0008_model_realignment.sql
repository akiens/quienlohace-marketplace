-- ---------------------------------------------------------------------------
-- El esquema pasa a ser el de `docs/data/databases_and_relationships.md`
-- ---------------------------------------------------------------------------

/*
 * El modelo documentado difiere del que venían armando 0001-0007 en cosas que
 * no se arreglan agregando columnas:
 *
 *   * `providers` guardaba un rubro y una subcategoría por perfil, y el modelo
 *     define `profiles` con especialidades muchos a muchos y los rubros
 *     derivados de ellas (BR-010).
 *   * la geografía vivía en el código con cuatro niveles, incluidos barrios, y
 *     ahora es la tabla jerárquica `locations` de tres niveles (BR-014).
 *   * la modalidad era una columna con 'hybrid' adentro, y ahora son varias
 *     filas: híbrida se deriva de tener más de una (BR-017).
 *   * los horarios eran una fila por día de semana, y ahora son hasta diez
 *     líneas de texto libre (BR-024).
 *   * los planes tenían topes de subcategorías y de integrantes de equipo, y
 *     el modelo cuenta rubros, especialidades, servicios, ubicaciones y
 *     galería, en pesos uruguayos (BR-006).
 *
 * Las tablas viejas se descartan en vez de migrarse: lo único que contienen es
 * el seed de desarrollo, que se regenera con `npm run seed:generate`. Migrar
 * fila por fila un dato de prueba costaría más que volver a generarlo, y no
 * hay perfiles reales que preservar.
 *
 * `provider_team_members` no reaparece: el modelo no tiene integrantes de
 * equipo y BR-006 no los lista como capacidad de ningún plan.
 */

PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_providers_downgrade;
DROP INDEX IF EXISTS idx_providers_pending_plan;
DROP INDEX IF EXISTS idx_provider_images_owner;
DROP INDEX IF EXISTS idx_provider_images_single_owner;
DROP INDEX IF EXISTS idx_provider_images_single;
DROP INDEX IF EXISTS idx_provider_images_provider;
DROP INDEX IF EXISTS idx_provider_subcategories_sub;
DROP INDEX IF EXISTS idx_service_areas_location;
DROP INDEX IF EXISTS idx_providers_ranking;
DROP INDEX IF EXISTS idx_providers_location;
DROP INDEX IF EXISTS idx_providers_subcategory;
DROP INDEX IF EXISTS idx_providers_category;
DROP INDEX IF EXISTS idx_providers_plan;
DROP INDEX IF EXISTS idx_providers_user;
DROP INDEX IF EXISTS idx_providers_slug;
DROP INDEX IF EXISTS idx_reviews_consumer_provider;
DROP INDEX IF EXISTS idx_reviews_author_provider;
DROP INDEX IF EXISTS idx_reviews_provider;
DROP INDEX IF EXISTS idx_review_reports_review;

DROP TABLE IF EXISTS review_reports;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS provider_team_members;
DROP TABLE IF EXISTS provider_social_links;
DROP TABLE IF EXISTS provider_hours;
DROP TABLE IF EXISTS provider_subcategories;
DROP TABLE IF EXISTS provider_images;
DROP TABLE IF EXISTS provider_payment_methods;
DROP TABLE IF EXISTS provider_service_areas;
DROP TABLE IF EXISTS provider_services;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS plans;

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

/*
 * `users` pierde `name`: el nombre es del perfil, no de la cuenta, y el
 * registro ya no lo pide (`docs/ui/register_form.md`). Gana `is_active`, que
 * BR-001 usa para impedir que una cuenta dada de baja inicie sesión.
 *
 * `password_hash` queda NOT NULL como pide el modelo. Las cuentas que sólo
 * tenían Google se descartan con el resto del seed.
 */
CREATE TABLE users_new (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  role           TEXT NOT NULL DEFAULT 'provider'
                 CHECK (role IN ('provider', 'admin', 'superadmin')),
  -- "pbkdf2:<iteraciones>:<salt>:<hash>" — PBKDF2-HMAC-SHA256 (TR-007).
  password_hash  TEXT NOT NULL,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

INSERT INTO users_new (
  id, email, email_verified, role, password_hash, is_active, created_at, updated_at
)
SELECT id, email, email_verified, role, password_hash, 1, created_at, updated_at
  FROM users
 WHERE password_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_users_email;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- El correo se guarda en minúsculas. NOCASE lo hace único sin distinguirlas.
CREATE UNIQUE INDEX idx_users_email ON users (email COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- locations — el catálogo geográfico deja de vivir en el código
-- ---------------------------------------------------------------------------

/*
 * Uruguay → departamento → localidad (BR-014). El árbol es autorreferenciado y
 * `RESTRICT` impide borrar un padre con hijos.
 *
 * Las filas las carga el seed desde `src/data/locations.json`, que genera
 * `npm run generate:locations` a partir de `docs/data/locations.md`.
 */
CREATE TABLE locations (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT REFERENCES locations (id) ON DELETE RESTRICT,
  type       TEXT NOT NULL CHECK (type IN ('country', 'department', 'locality')),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_locations_parent_id ON locations (parent_id);
CREATE INDEX idx_locations_type ON locations (type);
CREATE UNIQUE INDEX idx_locations_parent_slug ON locations (parent_id, slug);
-- TR-017: Uruguay es la única raíz. Un segundo país sin padre choca acá.
CREATE UNIQUE INDEX idx_locations_single_root
  ON locations ((1)) WHERE parent_id IS NULL;

-- ---------------------------------------------------------------------------
-- Taxonomía: rubro → especialidad
-- ---------------------------------------------------------------------------

CREATE TABLE service_sectors (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_service_sectors_name ON service_sectors (name COLLATE NOCASE);
CREATE UNIQUE INDEX idx_service_sectors_slug ON service_sectors (slug COLLATE NOCASE);

CREATE TABLE specialties (
  id                TEXT PRIMARY KEY,
  service_sector_id TEXT NOT NULL REFERENCES service_sectors (id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,
  -- BR-020: salud, contabilidad, legal y seguros exigen habilitación vigente.
  requires_professional_credential INTEGER NOT NULL DEFAULT 0
                    CHECK (requires_professional_credential IN (0, 1)),
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_specialties_service_sector_slug
  ON specialties (service_sector_id, slug COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- service_modes — a domicilio, en el negocio, a distancia
-- ---------------------------------------------------------------------------

/*
 * BR-017: "híbrida" no es una cuarta modalidad. Son tres filas y elegir varias
 * es lo que la produce, así que no se persiste ningún valor derivado (TR-001).
 */
CREATE TABLE service_modes (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL CHECK (code IN ('at_customer', 'at_business', 'remote')),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_service_modes_code ON service_modes (code);

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------

/*
 * Los topes se cuentan sobre elementos activos (BR-007). NULL es "sin límite
 * comercial" y 0 es "capacidad no incluida" (TR-002): por eso las columnas
 * admiten nulo, cosa que la versión anterior no hacía.
 */
CREATE TABLE plans (
  id          TEXT PRIMARY KEY CHECK (id IN ('cobre', 'gold', 'platinum')),
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency    TEXT NOT NULL DEFAULT 'UYU' CHECK (currency IN ('UYU')),
  period      TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month', 'year')),
  rank        INTEGER NOT NULL CHECK (rank > 0),

  max_service_sectors INTEGER CHECK (max_service_sectors IS NULL OR max_service_sectors >= 0),
  max_specialties     INTEGER CHECK (max_specialties IS NULL OR max_specialties >= 0),
  max_services        INTEGER CHECK (max_services IS NULL OR max_services >= 0),
  max_locations       INTEGER CHECK (max_locations IS NULL OR max_locations >= 0),
  max_gallery_images  INTEGER CHECK (max_gallery_images IS NULL OR max_gallery_images >= 0),

  allows_social_links         INTEGER NOT NULL DEFAULT 0 CHECK (allows_social_links IN (0, 1)),
  allows_verification_request INTEGER NOT NULL DEFAULT 0 CHECK (allows_verification_request IN (0, 1)),
  allows_featured_placement   INTEGER NOT NULL DEFAULT 0 CHECK (allows_featured_placement IN (0, 1)),
  allows_contact_form         INTEGER NOT NULL DEFAULT 0 CHECK (allows_contact_form IN (0, 1)),
  allows_custom_landing       INTEGER NOT NULL DEFAULT 0 CHECK (allows_custom_landing IN (0, 1)),
  allows_subdomain            INTEGER NOT NULL DEFAULT 0 CHECK (allows_subdomain IN (0, 1)),
  metrics_level TEXT NOT NULL DEFAULT 'basic'
                CHECK (metrics_level IN ('basic', 'intermediate', 'advanced')),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_plans_rank ON plans (rank);

/*
 * Valores de la matriz de BR-006. Oro y Platino quedan en precio 0 a propósito:
 * su precio es una decisión comercial pendiente (sección 10 de
 * business_rules.md) y TR-014 prohíbe ofrecerlos mientras valga 0. Inventar un
 * número acá los pondría a la venta.
 *
 * Platino tiene NULL en ubicaciones: es el único "sin límite" de la matriz.
 */
INSERT INTO plans (
  id, name, price_cents, currency, period, rank,
  max_service_sectors, max_specialties, max_services, max_locations,
  max_gallery_images, allows_social_links, allows_verification_request,
  allows_featured_placement, allows_contact_form, allows_custom_landing,
  allows_subdomain, metrics_level, created_at, updated_at
) VALUES
  ('cobre', 'Cobre', 0, 'UYU', 'month', 1,
   1, 2, 10, 1, 0,
   0, 0, 0, 0, 0, 0, 'basic',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z'),
  ('gold', 'Oro', 0, 'UYU', 'month', 2,
   2, 6, 25, 5, 5,
   1, 1, 0, 0, 0, 0, 'intermediate',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z'),
  ('platinum', 'Platino', 0, 'UYU', 'month', 3,
   3, 12, 50, NULL, 20,
   1, 1, 1, 1, 1, 1, 'advanced',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  contact_email     TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  phone_e164        TEXT NOT NULL DEFAULT '',
  -- NULL mientras no se verificó el teléfono actual (TR-010).
  phone_verified_at TEXT,
  whatsapp_enabled  INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp_enabled IN (0, 1)),
  phone_public      INTEGER NOT NULL DEFAULT 1 CHECK (phone_public IN (0, 1)),

  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'business')),
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'work',

  profile_status TEXT NOT NULL DEFAULT 'draft'
                 CHECK (profile_status IN ('draft', 'active', 'suspended', 'inactive')),
  -- Insignia comercial. Independiente del contacto y de las habilitaciones.
  verification_status TEXT NOT NULL DEFAULT 'not_requested'
                 CHECK (verification_status IN ('not_requested', 'pending', 'verified', 'rejected')),

  plan_id             TEXT NOT NULL DEFAULT 'cobre' REFERENCES plans (id) ON DELETE RESTRICT,
  subscription_status TEXT NOT NULL DEFAULT 'active'
                 CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  plan_expires_at     TEXT,
  downgrade_plan_id   TEXT REFERENCES plans (id) ON DELETE RESTRICT,
  purge_excess_after  TEXT,

  rating_sum   INTEGER NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_profiles_user_id ON profiles (user_id);
CREATE UNIQUE INDEX idx_profiles_slug ON profiles (slug COLLATE NOCASE);
CREATE INDEX idx_profiles_plan_id ON profiles (plan_id);
CREATE INDEX idx_profiles_profile_status ON profiles (profile_status);
CREATE INDEX idx_profiles_plan_expiry_downgrade
  ON profiles (plan_expires_at, downgrade_plan_id) WHERE downgrade_plan_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Relaciones del perfil
-- ---------------------------------------------------------------------------

CREATE TABLE profile_service_modes (
  profile_id      TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  service_mode_id TEXT NOT NULL REFERENCES service_modes (id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, service_mode_id)
);

CREATE INDEX idx_profile_service_modes_service_mode_id
  ON profile_service_modes (service_mode_id);

CREATE TABLE profile_social_links (
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  platform   TEXT NOT NULL
             CHECK (platform IN ('instagram', 'facebook', 'linkedin',
                                 'x', 'tiktok', 'youtube', 'website')),
  url        TEXT NOT NULL,
  -- BR-022: en Cobre se conservan, pero inactivos.
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, platform)
);

CREATE TABLE profile_payment_methods (
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- Códigos en inglés (TR-001). Las etiquetas en español son de la UI.
  method     TEXT NOT NULL
             CHECK (method IN ('cash', 'bank_transfer', 'debit_card',
                               'credit_card', 'other')),
  PRIMARY KEY (profile_id, method)
);

CREATE INDEX idx_profile_payment_methods_method_profile
  ON profile_payment_methods (method, profile_id);

/*
 * Dónde está el local (BR-015), que no es lo mismo que dónde presta servicio.
 * Uruguay no es una ubicación física válida: eso lo comprueba la aplicación,
 * porque el CHECK no puede mirar `locations.type` de otra tabla.
 */
CREATE TABLE profile_locations (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  name        TEXT,
  address     TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_profile_locations_profile_id ON profile_locations (profile_id);
CREATE INDEX idx_profile_locations_location_id ON profile_locations (location_id);
-- BR-015: una sola principal, y tiene que estar activa.
CREATE UNIQUE INDEX idx_profile_locations_active_primary
  ON profile_locations (profile_id) WHERE is_primary = 1 AND is_active = 1;

-- Dónde presta servicio (BR-016). Puede ser el país, un departamento o una
-- localidad. La normalización que evita solapamientos es TR-018.
CREATE TABLE profile_service_areas (
  profile_id  TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, location_id)
);

CREATE INDEX idx_profile_service_areas_location_id
  ON profile_service_areas (location_id);

/*
 * Las especialidades del perfil. Los rubros no tienen tabla propia: se derivan
 * de acá (BR-010), así que no hay dos lugares que puedan discrepar.
 */
CREATE TABLE profile_specialties (
  profile_id   TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL REFERENCES specialties (id) ON DELETE RESTRICT,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (profile_id, specialty_id)
);

CREATE INDEX idx_profile_specialties_specialty_id
  ON profile_specialties (specialty_id);

-- ---------------------------------------------------------------------------
-- professional_credentials — habilitaciones de actividades reguladas
-- ---------------------------------------------------------------------------

/*
 * BR-020. Es independiente de `profiles.verification_status`, que es la
 * insignia comercial: una habilitación aprobada no da insignia, y la insignia
 * no habilita a publicar servicios regulados.
 */
CREATE TABLE professional_credentials (
  id                   TEXT PRIMARY KEY,
  profile_id           TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  specialty_id         TEXT NOT NULL REFERENCES specialties (id) ON DELETE RESTRICT,
  credential_name      TEXT NOT NULL,
  credential_number    TEXT NOT NULL DEFAULT '',
  issuing_authority    TEXT NOT NULL,
  -- Clave privada del documento probatorio: nunca se expone públicamente.
  document_storage_key TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'verified', 'rejected', 'revoked', 'expired')),
  expires_at           TEXT,
  submitted_at         TEXT NOT NULL,
  reviewed_at          TEXT,
  reviewed_by_user_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  rejection_reason     TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX idx_professional_credentials_profile_specialty
  ON professional_credentials (profile_id, specialty_id);
CREATE INDEX idx_professional_credentials_status_expiry
  ON professional_credentials (status, expires_at);
CREATE UNIQUE INDEX idx_professional_credentials_storage_key
  ON professional_credentials (document_storage_key);
-- Una sola solicitud viva por perfil y especialidad. Las resueltas no estorban.
CREATE UNIQUE INDEX idx_professional_credentials_current
  ON professional_credentials (profile_id, specialty_id)
  WHERE status IN ('pending', 'verified');

-- ---------------------------------------------------------------------------
-- services — texto libre dentro de una especialidad ya elegida
-- ---------------------------------------------------------------------------

/*
 * La FK compuesta contra `profile_specialties` es la que garantiza BR-010: un
 * servicio no puede colgar de una especialidad que el perfil no seleccionó.
 * Con dos FK sueltas esa regla quedaría sólo en la aplicación.
 *
 * El catálogo de `taxonomy.json` es autocompletado, no una tabla de la que
 * dependa esta fila: lo que se guarda es el texto confirmado (BR-011).
 */
CREATE TABLE services (
  id           TEXT PRIMARY KEY,
  profile_id   TEXT NOT NULL,
  specialty_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (profile_id, specialty_id)
    REFERENCES profile_specialties (profile_id, specialty_id) ON DELETE CASCADE
);

CREATE INDEX idx_services_specialty_id ON services (specialty_id);
-- BR-011: no se repite el mismo servicio dentro de una especialidad.
CREATE UNIQUE INDEX idx_services_profile_specialty_name
  ON services (profile_id, specialty_id, name COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- profile_images
-- ---------------------------------------------------------------------------

/*
 * La imagen puede existir antes que el perfil: en el alta se piden la foto y
 * la portada cuando todavía no hay fila en `profiles`. Por eso `profile_id` es
 * nulo y `owner_user_id` no: el dueño es quien subió el archivo y es lo que
 * autoriza a borrarlo (BR-021).
 */
CREATE TABLE profile_images (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT REFERENCES profiles (id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key   TEXT NOT NULL,
  alt           TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  kind          TEXT NOT NULL DEFAULT 'gallery'
                CHECK (kind IN ('avatar', 'cover', 'gallery')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_profile_images_profile_sort ON profile_images (profile_id, sort_order);
CREATE INDEX idx_profile_images_owner_kind ON profile_images (owner_user_id, kind);
CREATE UNIQUE INDEX idx_profile_images_storage_key ON profile_images (storage_key);
-- Una foto y una portada por perfil, y otra tanto por dueño mientras dura el alta.
CREATE UNIQUE INDEX idx_profile_images_single_profile_kind
  ON profile_images (profile_id, kind)
  WHERE kind IN ('avatar', 'cover') AND profile_id IS NOT NULL;
CREATE UNIQUE INDEX idx_profile_images_single_owner_kind
  ON profile_images (owner_user_id, kind) WHERE kind IN ('avatar', 'cover');

-- ---------------------------------------------------------------------------
-- profile_schedule_entries — hasta diez líneas de texto libre
-- ---------------------------------------------------------------------------

/*
 * BR-024. Reemplaza la fila por día de semana: el formato anterior no podía
 * expresar "Atención solo con agenda previa" ni un horario cortado sin
 * inventar columnas. El largo (3-120) y el rechazo de teléfonos, correos, URLs
 * y HTML los aplica la aplicación (TR-005).
 */
CREATE TABLE profile_schedule_entries (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_profile_schedule_entries_profile_sort
  ON profile_schedule_entries (profile_id, sort_order);

-- ---------------------------------------------------------------------------
-- Clientes y opiniones
-- ---------------------------------------------------------------------------

/*
 * `consumer_users` y `consumer_sessions` ya existían con esta forma. Se
 * conservan tal cual salvo el nombre de la columna que apunta al cliente en
 * las sesiones, que el modelo llama `consumer_user_id`.
 */
CREATE TABLE consumer_sessions_new (
  id               TEXT PRIMARY KEY,
  consumer_user_id TEXT NOT NULL REFERENCES consumer_users (id) ON DELETE CASCADE,
  expires_at       TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

INSERT INTO consumer_sessions_new (id, consumer_user_id, expires_at, created_at)
SELECT id, user_id, expires_at, created_at FROM consumer_sessions;

DROP INDEX IF EXISTS idx_consumer_sessions_user;
DROP INDEX IF EXISTS idx_consumer_sessions_expires;
DROP TABLE consumer_sessions;
ALTER TABLE consumer_sessions_new RENAME TO consumer_sessions;

CREATE INDEX idx_consumer_sessions_consumer_user_id
  ON consumer_sessions (consumer_user_id);
CREATE INDEX idx_consumer_sessions_expires_at ON consumer_sessions (expires_at);

CREATE TABLE reviews (
  id               TEXT PRIMARY KEY,
  profile_id       TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  -- NULL en opiniones importadas o de semilla (TR-028).
  consumer_user_id TEXT REFERENCES consumer_users (id) ON DELETE SET NULL,
  author_name      TEXT NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT NOT NULL DEFAULT '',
  -- Sólo 'published' se muestra y suma a la calificación (BR-026).
  status           TEXT NOT NULL DEFAULT 'published'
                   CHECK (status IN ('published', 'hidden')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX idx_reviews_profile_status_created
  ON reviews (profile_id, status, created_at DESC);
-- BR-026: una opinión por cliente y perfil.
CREATE UNIQUE INDEX idx_reviews_profile_consumer_user
  ON reviews (profile_id, consumer_user_id) WHERE consumer_user_id IS NOT NULL;

CREATE TABLE review_reports (
  id                  TEXT PRIMARY KEY,
  review_id           TEXT NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  consumer_user_id    TEXT REFERENCES consumer_users (id) ON DELETE SET NULL,
  user_id             TEXT REFERENCES users (id) ON DELETE SET NULL,
  reason              TEXT NOT NULL
                      CHECK (reason IN ('spam', 'offensive', 'false_info',
                                        'personal_info', 'conflict', 'other')),
  detail              TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'upheld', 'dismissed')),
  created_at          TEXT NOT NULL,
  resolved_at         TEXT,
  resolved_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_review_reports_review_status ON review_reports (review_id, status);
CREATE INDEX idx_review_reports_consumer_user_id
  ON review_reports (consumer_user_id) WHERE consumer_user_id IS NOT NULL;
CREATE INDEX idx_review_reports_user_id
  ON review_reports (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_review_reports_resolved_by_user_id
  ON review_reports (resolved_by_user_id) WHERE resolved_by_user_id IS NOT NULL;
-- BR-027: una identidad reporta una opinión como máximo una vez.
CREATE UNIQUE INDEX idx_review_reports_review_consumer_user
  ON review_reports (review_id, consumer_user_id) WHERE consumer_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_review_reports_review_user
  ON review_reports (review_id, user_id) WHERE user_id IS NOT NULL;

-- Las tres modalidades de BR-017. Los ids son estables y legibles: son
-- catálogo, no datos transaccionales.
INSERT INTO service_modes (id, code, name, created_at, updated_at) VALUES
  ('at_customer', 'at_customer', 'En el domicilio del cliente',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z'),
  ('at_business', 'at_business', 'En el negocio',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z'),
  ('remote', 'remote', 'A distancia',
   '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z');
