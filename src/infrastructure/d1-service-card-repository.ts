import "server-only";

import { coveringLocationIds } from "@/data/locations";
import { getDb } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import { slugify } from "@/lib/slug";
import type {
  PaymentMethod,
  SearchFilters,
  ServiceCard,
  ServiceCardPriceKind,
  ServiceCardTier,
  ServiceModeCode,
} from "@/types";

type CardRow = {
  id: string;
  profile_id: string;
  provider_slug: string;
  provider_name: string;
  provider_icon: string;
  verification_status: string;
  rating_sum: number;
  review_count: number;
  provider_location_id: string | null;
  specialty_id: string;
  slug: string;
  title: string;
  description: string;
  price_kind: string;
  price_min_cents: number | null;
  price_max_cents: number | null;
  currency: string;
  tier: string;
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
  service_mode: string;
  payment_method: string | null;
  schedule: string;
  image_id: string | null;
  image_storage_key: string | null;
  is_published: number;
  is_active: number;
  sort_order: number;
};

export type ServiceCardInput = {
  specialtyId: string;
  title: string;
  description: string;
  priceKind: ServiceCardPriceKind;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  tier: ServiceCardTier;
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
  serviceMode: ServiceModeCode;
  paymentMethod: PaymentMethod | null;
  schedule: string;
  imageId: string | null;
  isPublished: boolean;
};

const SELECT = `sc.id, sc.profile_id, p.slug AS provider_slug,
  p.name AS provider_name, p.icon AS provider_icon, p.verification_status,
  p.rating_sum, p.review_count,
  COALESCE(
    (SELECT pl.location_id FROM profile_locations pl
      WHERE pl.profile_id = p.id AND pl.is_active = 1
      ORDER BY pl.is_primary DESC, pl.created_at LIMIT 1),
    (SELECT psa.location_id FROM profile_service_areas psa
      WHERE psa.profile_id = p.id LIMIT 1), 'uruguay'
  ) AS provider_location_id,
  sc.specialty_id, sc.slug, sc.title, sc.description, sc.price_kind,
  sc.price_min_cents, sc.price_max_cents, sc.currency, sc.tier,
  sc.duration_min_minutes, sc.duration_max_minutes, sc.service_mode,
  sc.payment_method, sc.schedule, sc.image_id,
  pi.storage_key AS image_storage_key, sc.is_published, sc.is_active,
  sc.sort_order`;

const FROM = `FROM service_cards sc
  JOIN profiles p ON p.id = sc.profile_id
  LEFT JOIN profile_images pi ON pi.id = sc.image_id
    AND pi.is_active = 1 AND pi.lifecycle = 'confirmed'`;

function toCard(row: CardRow): ServiceCard {
  return {
    id: row.id,
    profileId: row.profile_id,
    providerSlug: row.provider_slug,
    providerName: row.provider_name,
    providerIcon: row.provider_icon,
    providerVerified: row.verification_status === "verified",
    providerRating: row.review_count > 0 ? row.rating_sum / row.review_count : null,
    providerReviewCount: row.review_count,
    providerLocationId: row.provider_location_id ?? "uruguay",
    specialtyId: row.specialty_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceKind: row.price_kind as ServiceCardPriceKind,
    priceMinCents: row.price_min_cents,
    priceMaxCents: row.price_max_cents,
    currency: "UYU",
    tier: row.tier as ServiceCardTier,
    durationMinMinutes: row.duration_min_minutes,
    durationMaxMinutes: row.duration_max_minutes,
    serviceMode: row.service_mode as ServiceModeCode,
    paymentMethod: row.payment_method as PaymentMethod | null,
    schedule: row.schedule,
    imageId: row.image_id,
    imageUrl: row.image_storage_key ? `/media/${row.image_storage_key}` : null,
    isPublished: row.is_published === 1,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  };
}

function buildSearchWhere(filters: SearchFilters) {
  const where = ["sc.is_active = 1", "sc.is_published = 1", "p.profile_status = 'active'",
    "EXISTS (SELECT 1 FROM profile_specialties ps WHERE ps.profile_id = p.id AND ps.specialty_id = sc.specialty_id AND ps.is_active = 1)"];
  const values: (string | number)[] = [];
  const query = filters.query.trim();
  if (query) {
    where.push("(sc.title LIKE ? OR sc.description LIKE ? OR p.name LIKE ?)");
    values.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (filters.specialtyIds.length) {
    where.push(`sc.specialty_id IN (${filters.specialtyIds.map(() => "?").join(",")})`);
    values.push(...filters.specialtyIds);
  }
  if (filters.serviceModes.length) {
    where.push(`sc.service_mode IN (${filters.serviceModes.map(() => "?").join(",")})`);
    values.push(...filters.serviceModes);
  }
  if (filters.paymentMethods.length) {
    where.push(`sc.payment_method IN (${filters.paymentMethods.map(() => "?").join(",")})`);
    values.push(...filters.paymentMethods);
  }
  if (filters.minRating !== null) {
    where.push("p.review_count > 0 AND CAST(p.rating_sum AS REAL) / p.review_count >= ?");
    values.push(filters.minRating);
  }
  if (filters.locationIds.length) {
    const covered = [...new Set(filters.locationIds.flatMap(coveringLocationIds))];
    const marks = covered.map(() => "?").join(",");
    where.push(`EXISTS (SELECT 1 FROM profile_service_areas psa
      WHERE psa.profile_id = p.id AND psa.location_id IN (${marks}))`);
    values.push(...covered);
  }
  return { where: where.join(" AND "), values, query };
}

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const db = getDb();
  const root = slugify(title) || "servicio";
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? root : `${root}-${suffix}`;
    const row = await db.prepare("SELECT id FROM service_cards WHERE slug = ? COLLATE NOCASE")
      .bind(candidate).first<{ id: string }>();
    if (!row || row.id === excludeId) return candidate;
  }
  return `${root}-${newId().slice(0, 6)}`;
}

export class D1ServiceCardRepository {
  async listPublicSlugs(): Promise<string[]> {
    const result = await getDb().prepare(
      `SELECT sc.slug FROM service_cards sc JOIN profiles p ON p.id = sc.profile_id
       WHERE sc.is_active = 1 AND sc.is_published = 1 AND p.profile_status = 'active'
         AND EXISTS (SELECT 1 FROM profile_specialties ps WHERE ps.profile_id = p.id
           AND ps.specialty_id = sc.specialty_id AND ps.is_active = 1)
       ORDER BY sc.updated_at DESC`,
    ).all<{ slug: string }>();
    return result.results.map((row) => row.slug);
  }

  async listForProfile(profileId: string, owner = false): Promise<ServiceCard[]> {
    const condition = owner ? "" : `AND sc.is_active = 1 AND sc.is_published = 1
      AND p.profile_status = 'active'
      AND EXISTS (SELECT 1 FROM profile_specialties ps WHERE ps.profile_id = p.id
        AND ps.specialty_id = sc.specialty_id AND ps.is_active = 1)`;
    const result = await getDb().prepare(
      `SELECT ${SELECT} ${FROM} WHERE sc.profile_id = ? ${condition} ORDER BY sc.sort_order, sc.created_at`,
    ).bind(profileId).all<CardRow>();
    return result.results.map(toCard);
  }

  async findPublicBySlug(slug: string): Promise<ServiceCard | null> {
    const row = await getDb().prepare(
      `SELECT ${SELECT} ${FROM}
       WHERE sc.slug = ? COLLATE NOCASE AND sc.is_active = 1
         AND sc.is_published = 1 AND p.profile_status = 'active'
         AND EXISTS (SELECT 1 FROM profile_specialties ps WHERE ps.profile_id = p.id
           AND ps.specialty_id = sc.specialty_id AND ps.is_active = 1)`,
    ).bind(slug).first<CardRow>();
    return row ? toCard(row) : null;
  }

  async findOwned(id: string, userId: string): Promise<ServiceCard | null> {
    const row = await getDb().prepare(
      `SELECT ${SELECT} ${FROM} WHERE sc.id = ? AND p.user_id = ?`,
    ).bind(id, userId).first<CardRow>();
    return row ? toCard(row) : null;
  }

  async save(profileId: string, input: ServiceCardInput, id?: string): Promise<string> {
    const db = getDb();
    const now = new Date().toISOString();
    if (id) {
      await db.prepare(
        `UPDATE service_cards SET specialty_id = ?, title = ?, description = ?,
          price_kind = ?, price_min_cents = ?, price_max_cents = ?, tier = ?,
          duration_min_minutes = ?, duration_max_minutes = ?, service_mode = ?,
          payment_method = ?, schedule = ?, image_id = ?, is_published = ?, updated_at = ?
         WHERE id = ? AND profile_id = ?`,
      ).bind(input.specialtyId, input.title, input.description, input.priceKind,
        input.priceMinCents, input.priceMaxCents, input.tier, input.durationMinMinutes,
        input.durationMaxMinutes, input.serviceMode, input.paymentMethod, input.schedule,
        input.imageId, input.isPublished ? 1 : 0, now, id, profileId).run();
      return id;
    }

    const cardId = newId();
    const slug = await uniqueSlug(input.title);
    const order = await db.prepare("SELECT COUNT(*) AS total FROM service_cards WHERE profile_id = ?")
      .bind(profileId).first<{ total: number }>();
    await db.prepare(
      `INSERT INTO service_cards (id, profile_id, specialty_id, slug, title, description,
        price_kind, price_min_cents, price_max_cents, tier, duration_min_minutes,
        duration_max_minutes, service_mode, payment_method, schedule, image_id,
        is_published, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(cardId, profileId, input.specialtyId, slug, input.title, input.description,
      input.priceKind, input.priceMinCents, input.priceMaxCents, input.tier,
      input.durationMinMinutes, input.durationMaxMinutes, input.serviceMode,
      input.paymentMethod, input.schedule, input.imageId, input.isPublished ? 1 : 0,
      order?.total ?? 0, now, now).run();
    return cardId;
  }

  async delete(id: string, profileId: string): Promise<void> {
    await getDb().prepare("DELETE FROM service_cards WHERE id = ? AND profile_id = ?")
      .bind(id, profileId).run();
  }

  async applyLimit(profileId: string, limit: number): Promise<void> {
    await getDb().batch([
      getDb().prepare("UPDATE service_cards SET is_active = 0 WHERE profile_id = ?").bind(profileId),
      getDb().prepare(
        `UPDATE service_cards SET is_active = 1 WHERE id IN (
           SELECT sc.id FROM service_cards sc WHERE sc.profile_id = ?
             AND EXISTS (SELECT 1 FROM profile_specialties ps
               WHERE ps.profile_id = sc.profile_id AND ps.specialty_id = sc.specialty_id
                 AND ps.is_active = 1)
           ORDER BY sc.sort_order, sc.created_at LIMIT ?
         )`,
      ).bind(profileId, limit),
    ]);
  }

  async search(filters: SearchFilters, limit = 48): Promise<ServiceCard[]> {
    const { where, values, query } = buildSearchWhere(filters);
    const rows = await getDb().prepare(
      `SELECT ${SELECT} ${FROM} WHERE ${where}
       ORDER BY CASE WHEN sc.title LIKE ? THEN 0 ELSE 1 END,
         p.review_count DESC, sc.sort_order LIMIT ?`,
    ).bind(...values, query ? `%${query}%` : "%", limit).all<CardRow>();
    return rows.results.map(toCard);
  }

  async count(filters: SearchFilters): Promise<number> {
    const { where, values } = buildSearchWhere(filters);
    const row = await getDb().prepare(
      `SELECT COUNT(*) AS total ${FROM} WHERE ${where}`,
    ).bind(...values).first<{ total: number }>();
    return row?.total ?? 0;
  }
}
