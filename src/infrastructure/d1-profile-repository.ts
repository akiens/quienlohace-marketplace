import "server-only";

import type {
  DraftLimits,
  ProfileDraft,
  ProfileRepository,
} from "@/domain/ports";
import type {
  ImageKind,
  PaymentMethod,
  PlanId,
  Profile,
  ProfileStatus,
  ProfileType,
  SearchFilters,
  ServiceModeCode,
  SocialLink,
} from "@/types";
import { coveringLocationIds } from "@/data/locations";
import type { DowngradeNoticeStage } from "@/domain/plan-changes";
import { getDb } from "@/infrastructure/cloudflare";
import { slugify } from "@/lib/slug";
import { newId } from "@/lib/id";

/**
 * Adapter D1 de ProfileRepository.
 *
 * Todas las consultas usan sentencias preparadas con bind(): nunca se
 * interpola texto de la persona usuaria dentro del SQL (TR-036). Lo único que
 * se concatena son placeholders `?` generados por cantidad.
 */

type ProfileRow = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  type: string;
  icon: string;
  description: string;
  contact_email: string;
  phone: string;
  phone_e164: string;
  phone_verified_at: string | null;
  whatsapp_enabled: number;
  phone_public: number;
  profile_status: string;
  verification_status: string;
  plan_id: string;
  subscription_status: string;
  plan_expires_at: string | null;
  downgrade_plan_id: string | null;
  downgrade_notice_dismissed_at: string | null;
  downgrade_notice_reminded_at: string | null;
  rating_sum: number;
  review_count: number;
};

/** `public` sólo trae lo publicado; `owner` trae también lo inactivo. */
type RelationScope = "public" | "owner";

/**
 * Filas relacionadas de un lote de perfiles, en un solo `batch` y no N+1.
 *
 * Lo que excede el plan queda guardado con `is_active = 0` (BR-009). El
 * público no debe verlo: un perfil que bajó a Cobre no puede seguir mostrando
 * la galería de Platino. El panel sí lo pide entero, para que su dueño pueda
 * editarlo y sepa que está ahí.
 */
async function loadRelations(ids: string[], scope: RelationScope = "public") {
  const empty = {
    specialties: new Map<string, string[]>(),
    services: new Map<string, Profile["services"]>(),
    modes: new Map<string, ServiceModeCode[]>(),
    areas: new Map<string, string[]>(),
    locations: new Map<string, Profile["locations"]>(),
    payments: new Map<string, PaymentMethod[]>(),
    schedule: new Map<string, Profile["scheduleEntries"]>(),
    social: new Map<string, SocialLink[]>(),
    images: new Map<string, Profile["images"]>(),
  };
  if (ids.length === 0) return empty;

  const db = getDb();
  const marks = ids.map(() => "?").join(",");
  const onlyActive = scope === "public" ? "AND is_active = 1" : "";

  const [
    specialties,
    services,
    modes,
    areas,
    locations,
    payments,
    schedule,
    social,
    images,
  ] = await db.batch<Record<string, string | number | null>>([
    db
      .prepare(
        `SELECT profile_id, specialty_id FROM profile_specialties
         WHERE profile_id IN (${marks}) ${onlyActive} ORDER BY sort_order`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT id, profile_id, specialty_id, name, is_active, sort_order
         FROM services
         WHERE profile_id IN (${marks}) ${onlyActive} ORDER BY sort_order, name`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT m.profile_id, sm.code FROM profile_service_modes m
           JOIN service_modes sm ON sm.id = m.service_mode_id
          WHERE m.profile_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT profile_id, location_id FROM profile_service_areas
         WHERE profile_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT id, profile_id, location_id, name, address, is_primary, is_active
         FROM profile_locations
         WHERE profile_id IN (${marks}) ${onlyActive}
         ORDER BY is_primary DESC, created_at`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT profile_id, method FROM profile_payment_methods
         WHERE profile_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT id, profile_id, text, sort_order FROM profile_schedule_entries
         WHERE profile_id IN (${marks}) ORDER BY sort_order`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT profile_id, platform, url, is_active FROM profile_social_links
         WHERE profile_id IN (${marks}) ${onlyActive}`,
      )
      .bind(...ids),
    db
      .prepare(
        /*
         * Sólo las confirmadas (TR-043): lo pendiente es de una edición que
         * todavía no se guardó y no puede aparecer en el perfil, ni siquiera
         * en el del propio dueño, que lo ve desde el formulario.
         */
        `SELECT id, profile_id, storage_key, alt, kind, sort_order, is_active,
                lifecycle, width, height
         FROM profile_images
         WHERE profile_id IN (${marks}) AND lifecycle = 'confirmed'
           ${onlyActive} ORDER BY sort_order`,
      )
      .bind(...ids),
  ]);

  const group = <T>(
    rows: Record<string, string | number | null>[] | undefined,
    pick: (row: Record<string, string | number | null>) => T,
  ): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const key = String(row.profile_id);
      const list = map.get(key);
      if (list) list.push(pick(row));
      else map.set(key, [pick(row)]);
    }
    return map;
  };

  // `batch()` devuelve un resultado por sentencia, en orden. El `?? []` cubre
  // el caso teórico de una respuesta corta sin romper el tipado.
  return {
    specialties: group(specialties?.results, (r) => String(r.specialty_id)),
    services: group(services?.results, (r) => ({
      id: String(r.id),
      specialtyId: String(r.specialty_id),
      name: String(r.name),
      isActive: Number(r.is_active) === 1,
      sortOrder: Number(r.sort_order),
    })),
    modes: group(modes?.results, (r) => String(r.code) as ServiceModeCode),
    areas: group(areas?.results, (r) => String(r.location_id)),
    locations: group(locations?.results, (r) => ({
      id: String(r.id),
      locationId: String(r.location_id),
      name: r.name === null ? null : String(r.name),
      address: r.address === null ? null : String(r.address),
      isPrimary: Number(r.is_primary) === 1,
      isActive: Number(r.is_active) === 1,
    })),
    payments: group(payments?.results, (r) => String(r.method) as PaymentMethod),
    schedule: group(schedule?.results, (r) => ({
      id: String(r.id),
      text: String(r.text),
      sortOrder: Number(r.sort_order),
    })),
    social: group(social?.results, (r) => ({
      platform: String(r.platform) as SocialLink["platform"],
      url: String(r.url),
      isActive: Number(r.is_active) === 1,
    })),
    images: group(images?.results, (r) => ({
      id: String(r.id),
      storageKey: String(r.storage_key),
      url: `/media/${String(r.storage_key)}`,
      alt: String(r.alt),
      kind: String(r.kind) as ImageKind,
      sortOrder: Number(r.sort_order),
      isActive: Number(r.is_active) === 1,
      lifecycle: "confirmed" as const,
      width: Number(r.width ?? 0),
      height: Number(r.height ?? 0),
    })),
  };
}

function toProfile(
  row: ProfileRow,
  relations: Awaited<ReturnType<typeof loadRelations>>,
): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    type: row.type as ProfileType,
    description: row.description,
    icon: row.icon,

    contactEmail: row.contact_email,
    phone: row.phone,
    phoneE164: row.phone_e164,
    phoneVerifiedAt: row.phone_verified_at,
    whatsappEnabled: row.whatsapp_enabled === 1,
    phonePublic: row.phone_public === 1,

    profileStatus: row.profile_status as ProfileStatus,
    verificationStatus: row.verification_status as Profile["verificationStatus"],

    planId: row.plan_id as PlanId,
    subscriptionStatus: row.subscription_status as Profile["subscriptionStatus"],
    planExpiresAt: row.plan_expires_at,
    downgradePlanId: (row.downgrade_plan_id ?? null) as PlanId | null,
    downgradeNoticeDismissedAt: row.downgrade_notice_dismissed_at ?? null,
    downgradeNoticeRemindedAt: row.downgrade_notice_reminded_at ?? null,

    /*
     * BR-026: sin opiniones el promedio no existe, no es cero. Se deriva de la
     * suma para no hacer un AVG por cada tarjeta del listado.
     */
    rating: row.review_count > 0 ? row.rating_sum / row.review_count : null,
    reviewCount: row.review_count,

    specialtyIds: relations.specialties.get(row.id) ?? [],
    services: relations.services.get(row.id) ?? [],
    serviceModes: relations.modes.get(row.id) ?? [],
    serviceAreaIds: relations.areas.get(row.id) ?? [],
    locations: relations.locations.get(row.id) ?? [],
    paymentMethods: relations.payments.get(row.id) ?? [],
    scheduleEntries: relations.schedule.get(row.id) ?? [],
    socialLinks: relations.social.get(row.id) ?? [],
    images: relations.images.get(row.id) ?? [],
  };
}

async function hydrate(
  rows: ProfileRow[],
  scope: RelationScope = "public",
): Promise<Profile[]> {
  const relations = await loadRelations(
    rows.map((row) => row.id),
    scope,
  );
  return rows.map((row) => toProfile(row, relations));
}

/*
 * Las columnas van calificadas con `p.` y toda consulta nombra la tabla como
 * `p`. Sin calificar, cualquier consulta que sume un JOIN —`listFeatured` une
 * con `plans`, que también tiene `id` y `name`— falla con "ambiguous column
 * name" en tiempo de ejecución.
 */
const SELECT_COLUMNS = `p.id, p.user_id, p.slug, p.name, p.type, p.icon,
  p.description, p.contact_email, p.phone, p.phone_e164, p.phone_verified_at,
  p.whatsapp_enabled, p.phone_public, p.profile_status, p.verification_status,
  p.plan_id, p.subscription_status, p.plan_expires_at, p.downgrade_plan_id,
  p.downgrade_notice_dismissed_at, p.downgrade_notice_reminded_at,
  p.rating_sum, p.review_count`;

/** BR-003: sólo los perfiles publicados son visibles en el sitio público. */
const PUBLIC_WHERE = `p.profile_status = 'active'`;

const ORDER = `ORDER BY
  CASE WHEN p.review_count > 0 THEN CAST(p.rating_sum AS REAL) / p.review_count ELSE -1 END DESC,
  p.review_count DESC`;

/** BR-005: genera un slug libre, agregando sufijo numérico si ya existe. */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const db = getDb();
  const base = slugify(name) || "profesional";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const row = await db
      .prepare(`SELECT id FROM profiles WHERE slug = ? COLLATE NOCASE`)
      .bind(candidate)
      .first<{ id: string }>();

    if (!row || row.id === excludeId) return candidate;
  }

  return `${base}-${newId().slice(0, 6)}`;
}

/** Sin topes: todo activo. Lo usa quien no aplica límites de plan. */
const UNLIMITED: DraftLimits = {
  specialties: null,
  services: null,
  locations: null,
  galleryImages: null,
  social: true,
};

/** true si el elemento en la posición `index` entra en el cupo. */
function within(index: number, limit: number | null): boolean {
  return limit === null || index < limit;
}

/**
 * Reescribe las filas hijas de un perfil dentro de un batch atómico.
 *
 * @param limits cuántos elementos de cada lista entran en el plan. Lo que pasa
 *   de ahí se guarda igual, con `is_active = 0`: BR-009 pide no borrar nada al
 *   bajar de plan, y así vuelve solo si se recontrata.
 */
function relationStatements(
  profileId: string,
  draft: ProfileDraft,
  limits: DraftLimits,
) {
  const db = getDb();
  const now = new Date().toISOString();

  /*
   * El orden importa: `services` tiene una FK compuesta contra
   * `profile_specialties`, así que se borra antes que ellas y se inserta
   * después. Al revés, la base rechazaría el lote.
   */
  const statements = [
    db.prepare(`DELETE FROM services WHERE profile_id = ?`).bind(profileId),
    db
      .prepare(`DELETE FROM profile_specialties WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_service_modes WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_service_areas WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_locations WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_payment_methods WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_schedule_entries WHERE profile_id = ?`)
      .bind(profileId),
    db
      .prepare(`DELETE FROM profile_social_links WHERE profile_id = ?`)
      .bind(profileId),
  ];

  /*
   * Las especialidades activas mandan sobre los servicios: BR-010 dice que
   * desactivar una desactiva también los suyos. Se resuelve acá y no en una
   * consulta aparte porque es la misma escritura.
   */
  const activeSpecialties = new Set<string>();

  draft.specialtyIds.forEach((specialtyId, index) => {
    const isActive = within(index, limits.specialties);
    if (isActive) activeSpecialties.add(specialtyId);

    statements.push(
      db
        .prepare(
          `INSERT INTO profile_specialties
             (profile_id, specialty_id, is_active, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(profileId, specialtyId, isActive ? 1 : 0, index, now, now),
    );
  });

  let activeServices = 0;
  draft.services.forEach((service, index) => {
    /*
     * Un servicio sólo puede estar activo si su especialidad lo está, y
     * además tiene que caber en el cupo. El contador avanza sólo con los que
     * quedan activos: si contara todos, un servicio de una especialidad
     * desactivada gastaría cupo sin mostrarse.
     */
    const isActive =
      activeSpecialties.has(service.specialtyId) &&
      within(activeServices, limits.services);
    if (isActive) activeServices += 1;

    statements.push(
      db
        .prepare(
          `INSERT INTO services
             (id, profile_id, specialty_id, name, is_active, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          profileId,
          service.specialtyId,
          service.name,
          isActive ? 1 : 0,
          index,
          now,
          now,
        ),
    );
  });

  for (const mode of draft.serviceModes) {
    statements.push(
      db
        .prepare(
          `INSERT INTO profile_service_modes (profile_id, service_mode_id)
           VALUES (?, ?)`,
        )
        .bind(profileId, mode),
    );
  }

  for (const locationId of draft.serviceAreaIds) {
    statements.push(
      db
        .prepare(
          `INSERT INTO profile_service_areas (profile_id, location_id)
           VALUES (?, ?)`,
        )
        .bind(profileId, locationId),
    );
  }

  draft.locations.forEach((location, index) => {
    const isActive = within(index, limits.locations);

    statements.push(
      db
        .prepare(
          `INSERT INTO profile_locations
             (id, profile_id, location_id, name, address, is_primary, is_active,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          profileId,
          location.locationId,
          location.name,
          location.address,
          // BR-015: si se desactiva, deja de ser la principal.
          location.isPrimary && isActive ? 1 : 0,
          isActive ? 1 : 0,
          now,
          now,
        ),
    );
  });

  for (const method of draft.paymentMethods) {
    statements.push(
      db
        .prepare(
          `INSERT INTO profile_payment_methods (profile_id, method) VALUES (?, ?)`,
        )
        .bind(profileId, method),
    );
  }

  draft.scheduleEntries.forEach((text, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO profile_schedule_entries
             (id, profile_id, text, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId(), profileId, text, index, now, now),
    );
  });

  for (const link of draft.socialLinks) {
    statements.push(
      db
        .prepare(
          `INSERT INTO profile_social_links
             (profile_id, platform, url, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        // BR-022: en Cobre se conservan, pero inactivos.
        .bind(profileId, link.platform, link.url, limits.social ? 1 : 0, now, now),
    );
  }

  return { statements, now };
}

export class D1ProfileRepository implements ProfileRepository {
  async findBySlug(slug: string): Promise<Profile | null> {
    const row = await getDb()
      .prepare(`SELECT ${SELECT_COLUMNS} FROM profiles p WHERE p.slug = ? COLLATE NOCASE`)
      .bind(slug)
      .first<ProfileRow>();

    if (!row) return null;
    const [profile] = await hydrate([row]);
    return profile ?? null;
  }

  /**
   * Perfiles publicados con nombre parecido, para sugerir cuando el buscado no
   * existe o no es público.
   *
   * La comparación es por slug: ya viene normalizado (sin tildes, en minúsculas
   * y con guiones), así que "plomeria-juan" encuentra a "Plomería Juan" sin
   * pelear con acentos.
   */
  async findSimilarByName(slug: string, limit: number): Promise<Profile[]> {
    const words = slug.split("-").filter((word) => word.length >= 3);
    if (words.length === 0) return [];

    // Una condición por palabra: alcanza con que coincida una para sugerir.
    const clause = words.map(() => `p.slug LIKE ?`).join(" OR ");

    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM profiles p
         WHERE ${PUBLIC_WHERE} AND p.slug != ? AND (${clause})
         ${ORDER} LIMIT ?`,
      )
      .bind(slug, ...words.map((word) => `%${word}%`), limit)
      .all<ProfileRow>();

    return hydrate(results ?? []);
  }

  /** Para el panel: incluye lo que quedó fuera del plan, para poder editarlo. */
  async findByUserId(userId: string): Promise<Profile | null> {
    const row = await getDb()
      .prepare(`SELECT ${SELECT_COLUMNS} FROM profiles p WHERE p.user_id = ?`)
      .bind(userId)
      .first<ProfileRow>();

    if (!row) return null;
    const [profile] = await hydrate([row], "owner");
    return profile ?? null;
  }

  async search(
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): Promise<Profile[]> {
    const { where, params } = buildSearchWhere(filters);
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM profiles p WHERE ${where} ${ORDER} LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<ProfileRow>();

    return hydrate(results);
  }

  async countForSearch(filters: SearchFilters): Promise<number> {
    const { where, params } = buildSearchWhere(filters);
    const row = await getDb()
      .prepare(`SELECT COUNT(*) AS total FROM profiles p WHERE ${where}`)
      .bind(...params)
      .first<{ total: number }>();

    return row?.total ?? 0;
  }

  /**
   * Perfiles de un rubro. No hay columna de rubro: se llega por las
   * especialidades activas, que es de donde se derivan (BR-010).
   */
  async listByServiceSector(serviceSectorId: string): Promise<Profile[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM profiles p
          WHERE ${PUBLIC_WHERE} AND EXISTS (
            SELECT 1 FROM profile_specialties ps
              JOIN specialties s ON s.id = ps.specialty_id
             WHERE ps.profile_id = p.id AND ps.is_active = 1
               AND s.service_sector_id = ?)
          ${ORDER}`,
      )
      .bind(serviceSectorId)
      .all<ProfileRow>();

    return hydrate(results);
  }

  async listBySpecialty(specialtyId: string): Promise<Profile[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM profiles p
          WHERE ${PUBLIC_WHERE} AND EXISTS (
            SELECT 1 FROM profile_specialties ps
             WHERE ps.profile_id = p.id AND ps.is_active = 1
               AND ps.specialty_id = ?)
          ${ORDER}`,
      )
      .bind(specialtyId)
      .all<ProfileRow>();

    return hydrate(results);
  }

  /**
   * BR-006: las posiciones destacadas son una capacidad del plan, no una marca
   * por perfil. Se resuelve contra `plans` en vez de una columna `featured`,
   * que sería un valor derivado persistido (TR-001).
   */
  async listFeatured(): Promise<Profile[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM profiles p
           JOIN plans pl ON pl.id = p.plan_id
          WHERE ${PUBLIC_WHERE} AND pl.allows_featured_placement = 1
          ${ORDER}`,
      )
      .all<ProfileRow>();

    return hydrate(results);
  }

  async listPublishedSlugs(): Promise<string[]> {
    const { results } = await getDb()
      .prepare(`SELECT p.slug FROM profiles p WHERE ${PUBLIC_WHERE}`)
      .all<{ slug: string }>();

    return results.map((row) => row.slug);
  }

  /** `planId` es el plan elegido en el registro; por defecto, Cobre. */
  async create(
    userId: string,
    draft: ProfileDraft,
    planId: PlanId = "cobre",
    limits: DraftLimits = UNLIMITED,
  ): Promise<Profile> {
    const db = getDb();
    const id = newId();
    const slug = await uniqueSlug(draft.name);
    const { statements, now } = relationStatements(id, draft, limits);

    await db.batch([
      db
        .prepare(
          `INSERT INTO profiles (
             id, user_id, slug, name, type, description, icon, contact_email,
             phone, phone_e164, whatsapp_enabled, phone_public, plan_id,
             profile_status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        )
        .bind(
          id,
          userId,
          slug,
          draft.name,
          draft.type,
          draft.description,
          draft.icon,
          draft.contactEmail,
          draft.phone,
          draft.phoneE164,
          draft.whatsappEnabled ? 1 : 0,
          draft.phonePublic ? 1 : 0,
          planId,
          now,
          now,
        ),
      ...statements,
    ]);

    const created = await this.findByUserId(userId);
    if (!created) throw new Error("No se pudo crear el perfil.");
    return created;
  }

  async update(
    profileId: string,
    draft: ProfileDraft,
    limits: DraftLimits = UNLIMITED,
  ): Promise<Profile> {
    const db = getDb();
    const slug = await uniqueSlug(draft.name, profileId);
    const { statements, now } = relationStatements(profileId, draft, limits);

    await db.batch([
      db
        .prepare(
          `UPDATE profiles SET
             slug = ?, name = ?, type = ?, description = ?, icon = ?,
             contact_email = ?, phone = ?, phone_e164 = ?, whatsapp_enabled = ?,
             phone_public = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          slug,
          draft.name,
          draft.type,
          draft.description,
          draft.icon,
          draft.contactEmail,
          draft.phone,
          draft.phoneE164,
          draft.whatsappEnabled ? 1 : 0,
          draft.phonePublic ? 1 : 0,
          now,
          profileId,
        ),
      ...statements,
    ]);

    const updated = await this.findBySlug(slug);
    if (!updated) throw new Error("No se pudo actualizar el perfil.");
    return updated;
  }

  /**
   * Activa un plan de inmediato y corre el vencimiento.
   *
   * Es lo que corresponde al subir: se cobra y las funciones quedan
   * disponibles en el acto. Limpia cualquier baja agendada — quien sube deja
   * sin efecto la baja que hubiera pedido antes.
   *
   * No toca las listas: qué queda activo se recalcula al guardar el perfil,
   * que es donde se conocen los topes del plan nuevo.
   */
  async setPlan(
    profileId: string,
    planId: PlanId,
    expiresAt?: string | null,
    /**
     * `past_due` cuando el plan es pago y todavía no se resolvió el cobro: el
     * plan queda activo —las funciones se habilitan en el acto— pero el
     * asistente sigue abierto para completarlo. `active` cuando no hay nada
     * que cobrar (Cobre) o ya se resolvió.
     */
    subscriptionStatus: "active" | "past_due" = "active",
  ): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles
            SET plan_id = ?, downgrade_plan_id = NULL,
                plan_expires_at = COALESCE(?, plan_expires_at),
                purge_excess_after = NULL, subscription_status = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        planId,
        expiresAt ?? null,
        subscriptionStatus,
        new Date().toISOString(),
        profileId,
      )
      .run();
  }

  /** Marca el plan como pago: cierra el paso pendiente del asistente. */
  async markPlanPaid(profileId: string): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles SET subscription_status = 'active', updated_at = ?
          WHERE id = ?`,
      )
      .bind(new Date().toISOString(), profileId)
      .run();
  }

  /**
   * Agenda una baja de plan para cuando termine el período pago.
   *
   * No toca `plan_id`: hasta el vencimiento sigue rigiendo el plan que se pagó
   * (BR-008), y quitar las funciones antes sería cobrar por algo que se dejó
   * de dar. Sólo anota a qué plan se baja y hasta cuándo se conserva lo que
   * quedará fuera.
   */
  async scheduleDowngrade(input: {
    profileId: string;
    downgradePlanId: PlanId;
    /** Fin del período pago. Se deja el que ya había si no viene otro. */
    expiresAt: string | null;
    /** Desde cuándo se puede borrar lo que exceda el plan nuevo (BR-009). */
    purgeAfter: string;
  }): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles
            SET downgrade_plan_id = ?,
                plan_expires_at = COALESCE(?, plan_expires_at),
                purge_excess_after = ?,
                -- Cada baja es un aviso distinto: el de la anterior, cerrado
                -- o no, no vale para ésta.
                downgrade_notice_dismissed_at = NULL,
                downgrade_notice_reminded_at = NULL,
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        input.downgradePlanId,
        input.expiresAt,
        input.purgeAfter,
        new Date().toISOString(),
        input.profileId,
      )
      .run();
  }

  /** Cancela una baja agendada: se sigue con el plan actual. */
  async cancelDowngrade(profileId: string): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles
            SET downgrade_plan_id = NULL, purge_excess_after = NULL,
                downgrade_notice_dismissed_at = NULL,
                downgrade_notice_reminded_at = NULL,
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(new Date().toISOString(), profileId)
      .run();
  }

  /**
   * Consolida una baja ya vencida: el plan bajado pasa a ser el contratado.
   *
   * El `WHERE` incluye `downgrade_plan_id = ?` para que sea idempotente
   * (TR-031): aplicarla dos veces no vuelve a bajar nada.
   */
  async applyDueDowngrade(profileId: string, planId: PlanId): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles
            SET plan_id = ?, downgrade_plan_id = NULL, plan_expires_at = NULL,
                downgrade_notice_dismissed_at = NULL,
                downgrade_notice_reminded_at = NULL,
                updated_at = ?
          WHERE id = ? AND downgrade_plan_id = ?`,
      )
      .bind(planId, new Date().toISOString(), profileId, planId)
      .run();
  }

  /**
   * Marca como cerrado uno de los dos avisos de la baja agendada.
   *
   * Cada etapa escribe su propia columna: cerrar el recordatorio de los
   * últimos días no puede contarse como haber cerrado el aviso normal —ni al
   * revés—, o uno de los dos no llegaría a mostrarse nunca.
   *
   * El `WHERE` exige que la baja siga agendada: si venció y se consolidó
   * mientras la pestaña estaba abierta no hay aviso que silenciar.
   */
  async dismissDowngradeNotice(
    profileId: string,
    stage: DowngradeNoticeStage,
  ): Promise<void> {
    // El nombre sale de un conjunto cerrado, nunca de la entrada del usuario.
    const column =
      stage === "reminder"
        ? "downgrade_notice_reminded_at"
        : "downgrade_notice_dismissed_at";

    const now = new Date().toISOString();

    await getDb()
      .prepare(
        `UPDATE profiles SET ${column} = ?, updated_at = ?
          WHERE id = ? AND downgrade_plan_id IS NOT NULL`,
      )
      .bind(now, now, profileId)
      .run();
  }

  async setStatus(profileId: string, status: ProfileStatus): Promise<void> {
    await getDb()
      .prepare(
        `UPDATE profiles SET profile_status = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(status, new Date().toISOString(), profileId)
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

  /*
   * Qué clase de resultado se pide.
   *
   * `individual` y `business` son valores de `p.type`. `service` todavía no
   * tiene entidad —la carta de servicio no existe— y por eso no aporta
   * ninguna condición: pedir sólo servicios no puede devolver perfiles, así
   * que devuelve vacío; pedirlo junto a un tipo de perfil no le quita nada a
   * ese tipo. Cuando exista, este es el lugar donde se suma su rama.
   */
  if (filters.resultKinds.length > 0) {
    const profileTypes = filters.resultKinds.filter(
      (kind) => kind === "individual" || kind === "business",
    );

    if (profileTypes.length === 0) {
      // Sólo se pidieron servicios, que aún no existen: ningún perfil aplica.
      clauses.push("0 = 1");
    } else if (profileTypes.length < 2) {
      const marks = profileTypes.map(() => "?").join(",");
      clauses.push(`p.type IN (${marks})`);
      params.push(...profileTypes);
    }
    // Con los dos tipos elegidos no se agrega nada: no acota.
  }

  if (filters.query) {
    /*
     * El texto busca en el nombre, la descripción y los servicios del perfil.
     * Los servicios están en otra tabla, así que van por EXISTS: un JOIN
     * duplicaría el perfil una vez por servicio que coincida.
     */
    clauses.push(
      `(p.name LIKE ? OR p.description LIKE ? OR EXISTS (
          SELECT 1 FROM services s
           WHERE s.profile_id = p.id AND s.is_active = 1 AND s.name LIKE ?))`,
    );
    const like = `%${filters.query}%`;
    params.push(like, like, like);
  }

  if (filters.locationIds.length > 0) {
    /*
     * TR-019: buscar en un lugar encuentra también a quien lo cubre desde más
     * arriba —cobertura nacional o el departamento— o desde más abajo, con una
     * localidad de ese departamento. `coveringLocationIds` resuelve esa
     * expansión y acá sólo se pregunta por el conjunto resultante.
     */
    const ids = [
      ...new Set(filters.locationIds.flatMap((id) => coveringLocationIds(id))),
    ];
    const marks = ids.map(() => "?").join(",");
    clauses.push(
      `EXISTS (SELECT 1 FROM profile_service_areas a
                WHERE a.profile_id = p.id AND a.location_id IN (${marks}))`,
    );
    params.push(...ids);
  }

  if (filters.specialtyIds.length > 0) {
    const marks = filters.specialtyIds.map(() => "?").join(",");
    clauses.push(
      `EXISTS (SELECT 1 FROM profile_specialties ps
                WHERE ps.profile_id = p.id AND ps.is_active = 1
                  AND ps.specialty_id IN (${marks}))`,
    );
    params.push(...filters.specialtyIds);
  }

  if (filters.minRating !== null) {
    // Sin opiniones no se alcanza ningún mínimo: el promedio no existe.
    clauses.push(
      `p.review_count > 0 AND CAST(p.rating_sum AS REAL) / p.review_count >= ?`,
    );
    params.push(filters.minRating);
  }

  if (filters.paymentMethods.length > 0) {
    const marks = filters.paymentMethods.map(() => "?").join(",");
    clauses.push(
      `EXISTS (SELECT 1 FROM profile_payment_methods pm
                WHERE pm.profile_id = p.id AND pm.method IN (${marks}))`,
    );
    params.push(...filters.paymentMethods);
  }

  if (filters.serviceModes.length > 0) {
    /*
     * BR-017: la modalidad se guarda por id en `profile_service_modes`, así
     * que se llega al código por `service_modes`. Elegir varias es "cualquiera
     * de estas" —quien atiende a domicilio y a distancia entra en las dos—,
     * que es lo mismo que hacen los otros filtros de lista.
     */
    const marks = filters.serviceModes.map(() => "?").join(",");
    clauses.push(
      `EXISTS (SELECT 1 FROM profile_service_modes psm
                 JOIN service_modes sm ON sm.id = psm.service_mode_id
                WHERE psm.profile_id = p.id AND sm.code IN (${marks}))`,
    );
    params.push(...filters.serviceModes);
  }

  return { where: clauses.join(" AND "), params };
}
