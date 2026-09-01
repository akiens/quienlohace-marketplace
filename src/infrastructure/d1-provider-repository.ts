import "server-only";

import type { ProviderDraft, ProviderRepository } from "@/domain/ports";
import type {
  PaymentMethod,
  PlanId,
  Provider,
  ProviderKind,
  ProviderStatus,
  SearchFilters,
} from "@/types";
import { getDb, getMediaBucket } from "@/infrastructure/cloudflare";
import { slugify } from "@/lib/slug";
import { newId } from "@/lib/id";

/**
 * Adapter D1 de ProviderRepository.
 *
 * Todas las consultas usan sentencias preparadas con bind(): nunca se
 * interpola texto del usuario dentro del SQL.
 */

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  icon: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  location_id: string;
  phone: string;
  whatsapp: string;
  schedule: string;
  status: string;
  featured: number;
  verified: number;
  rating_sum: number;
  review_count: number;
  plan_id: string;
  subscription_status: string;
  verification_status: string;
  phone_e164: string;
  whatsapp_enabled: number;
  phone_public: number;
  public_email: string;
  service_mode: string;
};

/** Filas relacionadas de un lote de proveedores, en 4 consultas y no N+1. */
async function loadRelations(ids: string[]) {
  if (ids.length === 0) {
    return { services: new Map(), areas: new Map(), payments: new Map(), images: new Map() };
  }

  const db = getDb();
  // Los placeholders se generan por cantidad; los valores siempre van por bind().
  const marks = ids.map(() => "?").join(",");

  const [services, areas, payments, images] = await db.batch<
    Record<string, string | number>
  >([
    db
      .prepare(
        `SELECT provider_id, name FROM provider_services
         WHERE provider_id IN (${marks}) ORDER BY position, name`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT provider_id, location_id FROM provider_service_areas
         WHERE provider_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT provider_id, method FROM provider_payment_methods
         WHERE provider_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT id, provider_id, storage_key, alt FROM provider_images
         WHERE provider_id IN (${marks}) ORDER BY position`,
      )
      .bind(...ids),
  ]);

  const group = <T>(
    rows: Record<string, string | number>[],
    pick: (row: Record<string, string | number>) => T,
  ) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = String(row.provider_id);
      const list = map.get(key) ?? [];
      list.push(pick(row));
      map.set(key, list);
    }
    return map;
  };

  // `batch()` devuelve un resultado por sentencia, en orden. El `?? []` cubre
  // el caso teórico de una respuesta corta sin romper el tipado.
  return {
    services: group(services?.results ?? [], (r) => String(r.name)),
    areas: group(areas?.results ?? [], (r) => String(r.location_id)),
    payments: group(payments?.results ?? [], (r) => String(r.method) as PaymentMethod),
    images: group(images?.results ?? [], (r) => ({
      id: String(r.id),
      storageKey: String(r.storage_key),
      url: `/media/${String(r.storage_key)}`,
      alt: String(r.alt),
    })),
  };
}

function toProvider(
  row: ProviderRow,
  relations: Awaited<ReturnType<typeof loadRelations>>,
): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind as ProviderKind,
    icon: row.icon,
    // La media se deriva de la suma: evita un AVG por cada card del listado.
    rating: row.review_count > 0 ? row.rating_sum / row.review_count : null,
    reviewCount: row.review_count,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    locationId: row.location_id,
    serviceAreaIds: relations.areas.get(row.id) ?? [],
    services: relations.services.get(row.id) ?? [],
    description: row.description,
    featured: row.featured === 1,
    verified: row.verified === 1,
    phone: row.phone,
    whatsapp: row.whatsapp,
    schedule: row.schedule,
    paymentMethods: relations.payments.get(row.id) ?? [],
    status: row.status as ProviderStatus,
    images: relations.images.get(row.id) ?? [],
    planId: row.plan_id as Provider["planId"],
    subscriptionStatus: row.subscription_status as Provider["subscriptionStatus"],
    verificationStatus: row.verification_status as Provider["verificationStatus"],
    phoneE164: row.phone_e164,
    whatsappEnabled: row.whatsapp_enabled === 1,
    phonePublic: row.phone_public === 1,
    publicEmail: row.public_email,
    serviceMode: row.service_mode as Provider["serviceMode"],
  };
}

async function hydrate(rows: ProviderRow[]): Promise<Provider[]> {
  const relations = await loadRelations(rows.map((r) => r.id));
  return rows.map((row) => toProvider(row, relations));
}

const SELECT_COLUMNS = `id, slug, name, kind, icon, description, category_id,
  subcategory_id, location_id, phone, whatsapp, schedule, status, featured,
  verified, rating_sum, review_count, plan_id, subscription_status,
  verification_status, phone_e164, whatsapp_enabled, phone_public,
  public_email, service_mode`;

/** Sólo los perfiles publicados son visibles en el sitio público. */
const PUBLIC_WHERE = `status = 'active'`;

const ORDER = `ORDER BY featured DESC,
  CASE WHEN review_count > 0 THEN CAST(rating_sum AS REAL) / review_count ELSE -1 END DESC,
  review_count DESC`;

/** Genera un slug libre, agregando sufijo si ya existe (RF-038/091). */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const db = getDb();
  const base = slugify(name) || "profesional";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const row = await db
      .prepare(`SELECT id FROM providers WHERE slug = ?`)
      .bind(candidate)
      .first<{ id: string }>();

    if (!row || row.id === excludeId) return candidate;
  }

  return `${base}-${newId().slice(0, 6)}`;
}

/** Reescribe las filas hijas de un proveedor dentro de un batch atómico. */
function relationStatements(providerId: string, draft: ProviderDraft) {
  const db = getDb();
  const now = new Date().toISOString();

  const statements = [
    db.prepare(`DELETE FROM provider_services WHERE provider_id = ?`).bind(providerId),
    db.prepare(`DELETE FROM provider_service_areas WHERE provider_id = ?`).bind(providerId),
    db.prepare(`DELETE FROM provider_payment_methods WHERE provider_id = ?`).bind(providerId),
  ];

  draft.services.forEach((name, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO provider_services (provider_id, name, position) VALUES (?, ?, ?)`,
        )
        .bind(providerId, name, index),
    );
  });

  for (const locationId of draft.serviceAreaIds) {
    statements.push(
      db
        .prepare(
          `INSERT INTO provider_service_areas (provider_id, location_id) VALUES (?, ?)`,
        )
        .bind(providerId, locationId),
    );
  }

  for (const method of draft.paymentMethods) {
    statements.push(
      db
        .prepare(
          `INSERT INTO provider_payment_methods (provider_id, method) VALUES (?, ?)`,
        )
        .bind(providerId, method),
    );
  }

  return { statements, now };
}

export class D1ProviderRepository implements ProviderRepository {
  async findBySlug(slug: string): Promise<Provider | null> {
    const row = await getDb()
      .prepare(`SELECT ${SELECT_COLUMNS} FROM providers WHERE slug = ?`)
      .bind(slug)
      .first<ProviderRow>();

    if (!row) return null;
    const [provider] = await hydrate([row]);
    return provider ?? null;
  }

  async findByUserId(userId: string): Promise<Provider | null> {
    const row = await getDb()
      .prepare(`SELECT ${SELECT_COLUMNS} FROM providers WHERE user_id = ?`)
      .bind(userId)
      .first<ProviderRow>();

    if (!row) return null;
    const [provider] = await hydrate([row]);
    return provider ?? null;
  }

  async search(
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): Promise<Provider[]> {
    const { where, params } = buildSearchWhere(filters);
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM providers WHERE ${where} ${ORDER} LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<ProviderRow>();

    return hydrate(results);
  }

  async countForSearch(filters: SearchFilters): Promise<number> {
    const { where, params } = buildSearchWhere(filters);
    const row = await getDb()
      .prepare(`SELECT COUNT(*) AS total FROM providers WHERE ${where}`)
      .bind(...params)
      .first<{ total: number }>();

    return row?.total ?? 0;
  }

  async listByCategory(categoryId: string): Promise<Provider[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM providers
         WHERE ${PUBLIC_WHERE} AND category_id = ? ${ORDER}`,
      )
      .bind(categoryId)
      .all<ProviderRow>();

    return hydrate(results);
  }

  async listBySubcategory(subcategoryId: string): Promise<Provider[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM providers
         WHERE ${PUBLIC_WHERE} AND subcategory_id = ? ${ORDER}`,
      )
      .bind(subcategoryId)
      .all<ProviderRow>();

    return hydrate(results);
  }

  async listFeatured(): Promise<Provider[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM providers
         WHERE ${PUBLIC_WHERE} AND featured = 1 ${ORDER}`,
      )
      .all<ProviderRow>();

    return hydrate(results);
  }

  async listPublishedSlugs(): Promise<string[]> {
    const { results } = await getDb()
      .prepare(`SELECT slug FROM providers WHERE ${PUBLIC_WHERE}`)
      .all<{ slug: string }>();

    return results.map((row) => row.slug);
  }

  /** `planId` es el plan elegido en el registro; por defecto, Cobre. */
  async create(
    userId: string,
    draft: ProviderDraft,
    planId: PlanId = "cobre",
  ): Promise<Provider> {
    const db = getDb();
    const id = newId();
    const slug = await uniqueSlug(draft.name);
    const { statements, now } = relationStatements(id, draft);

    await db.batch([
      db
        .prepare(
          `INSERT INTO providers (
             id, user_id, slug, name, kind, description, category_id,
             subcategory_id, location_id, phone, whatsapp, schedule,
             phone_e164, whatsapp_enabled, plan_id, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        )
        .bind(
          id, userId, slug, draft.name, draft.kind, draft.description,
          draft.categoryId, draft.subcategoryId, draft.locationId,
          draft.phone, draft.whatsapp, draft.schedule,
          draft.phoneE164, draft.whatsappEnabled ? 1 : 0, planId, now, now,
        ),
      ...statements,
    ]);

    const created = await this.findBySlug(slug);
    if (!created) throw new Error("No se pudo crear el perfil.");
    return created;
  }

  async update(providerId: string, draft: ProviderDraft): Promise<Provider> {
    const db = getDb();
    const slug = await uniqueSlug(draft.name, providerId);
    const { statements, now } = relationStatements(providerId, draft);

    await db.batch([
      db
        .prepare(
          `UPDATE providers SET
             slug = ?, name = ?, kind = ?, description = ?, category_id = ?,
             subcategory_id = ?, location_id = ?, phone = ?, whatsapp = ?,
             schedule = ?, phone_e164 = ?, whatsapp_enabled = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          slug, draft.name, draft.kind, draft.description, draft.categoryId,
          draft.subcategoryId, draft.locationId, draft.phone, draft.whatsapp,
          draft.schedule, draft.phoneE164, draft.whatsappEnabled ? 1 : 0,
          now, providerId,
        ),
      ...statements,
    ]);

    const updated = await this.findBySlug(slug);
    if (!updated) throw new Error("No se pudo actualizar el perfil.");
    return updated;
  }

  async setStatus(providerId: string, status: ProviderStatus): Promise<void> {
    await getDb()
      .prepare(`UPDATE providers SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(status, new Date().toISOString(), providerId)
      .run();
  }
}

/**
 * Arma el WHERE de búsqueda. Los valores viajan siempre por bind(); lo único
 * que se concatena son placeholders `?` generados por cantidad.
 */
function buildSearchWhere(filters: SearchFilters): {
  where: string;
  params: (string | number)[];
} {
  const clauses = [PUBLIC_WHERE];
  const params: (string | number)[] = [];

  const term = filters.query.trim();
  if (term) {
    // LIKE sobre nombre, descripción y servicios. Alcanza para el MVP;
    // si el volumen crece, corresponde un índice FTS5.
    clauses.push(
      `(name LIKE ?1 OR description LIKE ?1 OR id IN (
         SELECT provider_id FROM provider_services WHERE name LIKE ?1
       ))`,
    );
    params.push(`%${term}%`);
  }

  if (filters.subcategoryIds.length > 0) {
    const marks = filters.subcategoryIds.map(() => "?").join(",");
    clauses.push(`subcategory_id IN (${marks})`);
    params.push(...filters.subcategoryIds);
  }

  if (filters.locationIds.length > 0) {
    // Una localidad alcanza a sus barrios: comparten prefijo de id.
    const conditions = filters.locationIds
      .map(() => `(location_id = ? OR location_id LIKE ? OR id IN (
          SELECT provider_id FROM provider_service_areas
          WHERE location_id = ? OR location_id LIKE ?
        ))`)
      .join(" OR ");
    clauses.push(`(${conditions})`);
    for (const id of filters.locationIds) {
      params.push(id, `${id}-%`, id, `${id}-%`);
    }
  }

  if (filters.minRating !== null) {
    clauses.push(
      `review_count > 0 AND CAST(rating_sum AS REAL) / review_count >= ?`,
    );
    params.push(filters.minRating);
  }

  for (const method of filters.paymentMethods) {
    clauses.push(
      `id IN (SELECT provider_id FROM provider_payment_methods WHERE method = ?)`,
    );
    params.push(method);
  }

  return { where: clauses.join(" AND "), params };
}

/** Sube una imagen a R2 y la referencia en D1 (el binario nunca va a la base). */
export async function addProviderImage(input: {
  providerId: string;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  alt?: string;
}): Promise<void> {
  const db = getDb();
  const id = newId();
  const key = `providers/${input.providerId}/${id}.${input.extension}`;

  await getMediaBucket().put(key, input.body, {
    httpMetadata: { contentType: input.contentType },
  });

  const position = await db
    .prepare(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM provider_images WHERE provider_id = ?`,
    )
    .bind(input.providerId)
    .first<{ next: number }>();

  await db
    .prepare(
      `INSERT INTO provider_images (id, provider_id, storage_key, alt, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.providerId, key, input.alt ?? "", position?.next ?? 0, new Date().toISOString())
    .run();
}
