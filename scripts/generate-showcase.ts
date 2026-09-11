/**
 * Materializa las tarjetas de Inicio y de la portada de Buscar en un JSON que
 * Next puede importar durante `next build` sin abrir D1.
 *
 * Uso:
 *   npm run showcase:generate          # D1 local
 *   npm run showcase:generate:remote   # D1 de producción
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { MARKETPLACE_SHOWCASE } from "../src/data/marketplace-showcase";
import type {
  ImageKind,
  PaymentMethod,
  PlanId,
  Profile,
  ProfileImage,
  ProfileStatus,
  ProfileType,
  ServiceCard,
  ServiceCardPriceKind,
  ServiceCardTier,
  ServiceModeCode,
  SocialLink,
} from "../src/types";

type Row = Record<string, string | number | null>;
type WranglerResult = { results?: Row[]; success: boolean };

const remote = process.argv.includes("--remote");
const root = resolve(import.meta.dirname, "..");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const output = resolve(root, "src/data/marketplace-showcase.generated.json");

function query(statements: string[]): Row[][] {
  const stdout = execFileSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "quienlohace",
      remote ? "--remote" : "--local",
      "--command",
      statements.join(";\n"),
      "--json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as WranglerResult[];
  if (parsed.length !== statements.length || parsed.some((result) => !result.success)) {
    throw new Error("D1 no devolvió todos los conjuntos necesarios para el showcase.");
  }
  return parsed.map((result) => result.results ?? []);
}

function sqlIds(ids: string[]): string {
  if (ids.length === 0) return "NULL";
  return [...new Set(ids)].map((id) => `'${id.replaceAll("'", "''")}'`).join(",");
}

function text(row: Row, key: string): string {
  return String(row[key] ?? "");
}

function nullableText(row: Row, key: string): string | null {
  return row[key] === null || row[key] === undefined ? null : String(row[key]);
}

function number(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

function boolean(row: Row, key: string): boolean {
  return number(row, key) === 1;
}

function grouped(rows: Row[]): Map<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const row of rows) {
    const id = text(row, "profile_id");
    result.set(id, [...(result.get(id) ?? []), row]);
  }
  return result;
}

function image(row: Row, kind?: ImageKind): ProfileImage {
  const storageKey = text(row, "storage_key");
  return {
    id: text(row, "id"),
    storageKey,
    url: `/media/${storageKey}`,
    alt: text(row, "alt"),
    kind: kind ?? (text(row, "kind") as ImageKind),
    sortOrder: number(row, "sort_order"),
    isActive: row.is_active === undefined ? true : boolean(row, "is_active"),
    hiddenReason: nullableText(row, "hidden_reason") as ProfileImage["hiddenReason"],
    galleryState: (nullableText(row, "gallery_state") ?? "available") as ProfileImage["galleryState"],
    ownerHidden: row.owner_hidden === undefined ? false : boolean(row, "owner_hidden"),
    hiddenAt: nullableText(row, "hidden_at"),
    galleryRevision: null,
    gallerySelectionPending: false,
    lifecycle: (nullableText(row, "lifecycle") ?? "confirmed") as ProfileImage["lifecycle"],
    width: number(row, "width"),
    height: number(row, "height"),
  };
}

function loadProfiles(ids: string[]): Profile[] {
  if (ids.length === 0) return [];
  const list = sqlIds(ids);
  const [base = [], specialties = [], services = [], modes = [], areas = [], locations = [], payments = [], schedules = [], socials = [], images = []] = query([
    `SELECT * FROM profiles WHERE profile_status = 'active' AND id IN (${list})`,
    `SELECT profile_id, specialty_id FROM profile_specialties WHERE is_active = 1 AND profile_id IN (${list}) ORDER BY profile_id, sort_order`,
    `SELECT id, profile_id, specialty_id, name, is_active, sort_order FROM services WHERE is_active = 1 AND profile_id IN (${list}) ORDER BY profile_id, sort_order, name`,
    `SELECT m.profile_id, sm.code FROM profile_service_modes m JOIN service_modes sm ON sm.id = m.service_mode_id WHERE m.profile_id IN (${list}) ORDER BY m.profile_id`,
    `SELECT profile_id, location_id FROM profile_service_areas WHERE profile_id IN (${list}) ORDER BY profile_id`,
    `SELECT id, profile_id, location_id, name, address, is_primary, is_active FROM profile_locations WHERE is_active = 1 AND profile_id IN (${list}) ORDER BY profile_id, is_primary DESC, created_at`,
    `SELECT profile_id, method FROM profile_payment_methods WHERE profile_id IN (${list}) ORDER BY profile_id`,
    `SELECT id, profile_id, text, sort_order FROM profile_schedule_entries WHERE profile_id IN (${list}) ORDER BY profile_id, sort_order`,
    `SELECT profile_id, platform, url, is_active FROM profile_social_links WHERE is_active = 1 AND profile_id IN (${list}) ORDER BY profile_id, created_at`,
    `SELECT id, profile_id, storage_key, alt, kind, sort_order, is_active, hidden_reason, gallery_state, owner_hidden, hidden_at, lifecycle, width, height FROM profile_images WHERE lifecycle = 'confirmed' AND is_active = 1 AND profile_id IN (${list}) ORDER BY profile_id, sort_order`,
  ]);
  const relationGroups = [specialties, services, modes, areas, locations, payments, schedules, socials, images].map(grouped);
  const [specialtyMap, serviceMap, modeMap, areaMap, locationMap, paymentMap, scheduleMap, socialMap, imageMap] = relationGroups;

  const profiles = base.map((row): Profile => {
    const id = text(row, "id");
    const reviewCount = number(row, "review_count");
    return {
      id,
      userId: text(row, "user_id"),
      slug: text(row, "slug"),
      name: text(row, "name"),
      type: text(row, "type") as ProfileType,
      description: text(row, "description"),
      icon: text(row, "icon"),
      contactEmail: text(row, "contact_email"),
      phone: text(row, "phone"),
      phoneE164: text(row, "phone_e164"),
      phoneVerifiedAt: nullableText(row, "phone_verified_at"),
      whatsappEnabled: boolean(row, "whatsapp_enabled"),
      phonePublic: boolean(row, "phone_public"),
      profileStatus: text(row, "profile_status") as ProfileStatus,
      verificationStatus: text(row, "verification_status") as Profile["verificationStatus"],
      planId: text(row, "plan_id") as PlanId,
      subscriptionStatus: text(row, "subscription_status") as Profile["subscriptionStatus"],
      planExpiresAt: nullableText(row, "plan_expires_at"),
      downgradePlanId: nullableText(row, "downgrade_plan_id") as PlanId | null,
      downgradeNoticeDismissedAt: nullableText(row, "downgrade_notice_dismissed_at"),
      downgradeNoticeRemindedAt: nullableText(row, "downgrade_notice_reminded_at"),
      rating: reviewCount > 0 ? number(row, "rating_sum") / reviewCount : null,
      reviewCount,
      specialtyIds: (specialtyMap?.get(id) ?? []).map((item) => text(item, "specialty_id")),
      services: (serviceMap?.get(id) ?? []).map((item) => ({
        id: text(item, "id"), specialtyId: text(item, "specialty_id"),
        name: text(item, "name"), isActive: boolean(item, "is_active"),
        sortOrder: number(item, "sort_order"),
      })),
      serviceModes: (modeMap?.get(id) ?? []).map((item) => text(item, "code") as ServiceModeCode),
      serviceAreaIds: (areaMap?.get(id) ?? []).map((item) => text(item, "location_id")),
      locations: (locationMap?.get(id) ?? []).map((item) => ({
        id: text(item, "id"), locationId: text(item, "location_id"),
        name: nullableText(item, "name"), address: nullableText(item, "address"),
        isPrimary: boolean(item, "is_primary"), isActive: boolean(item, "is_active"),
      })),
      paymentMethods: (paymentMap?.get(id) ?? []).map((item) => text(item, "method") as PaymentMethod),
      scheduleEntries: (scheduleMap?.get(id) ?? []).map((item) => ({
        id: text(item, "id"), text: text(item, "text"), sortOrder: number(item, "sort_order"),
      })),
      socialLinks: (socialMap?.get(id) ?? []).map((item) => ({
        platform: text(item, "platform") as SocialLink["platform"],
        url: text(item, "url"), isActive: boolean(item, "is_active"),
      })),
      images: (imageMap?.get(id) ?? []).map((item) => image(item)),
    };
  });
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}

function loadCards(ids: string[]): ServiceCard[] {
  if (ids.length === 0) return [];
  const list = sqlIds(ids);
  const [rows = [], imageRows = []] = query([
    `SELECT sc.id, sc.profile_id, p.slug AS provider_slug, p.name AS provider_name,
      p.icon AS provider_icon, p.verification_status, p.rating_sum, p.review_count,
      COALESCE((SELECT pl.location_id FROM profile_locations pl WHERE pl.profile_id = p.id AND pl.is_active = 1 ORDER BY pl.is_primary DESC, pl.created_at LIMIT 1),
        (SELECT psa.location_id FROM profile_service_areas psa WHERE psa.profile_id = p.id LIMIT 1), 'uruguay') AS provider_location_id,
      s.specialty_id, sc.service_id, s.name AS service_name, sc.slug, sc.title,
      sc.description, sc.price_kind, sc.price_min_cents, sc.price_max_cents,
      sc.currency, sc.tier, sc.duration_min_minutes, sc.duration_max_minutes,
      sc.service_mode, sc.payment_method, sc.schedule, sc.image_id,
      pi.storage_key AS image_storage_key, sc.is_published, sc.is_active, sc.sort_order
      FROM service_cards sc JOIN profiles p ON p.id = sc.profile_id
      JOIN services s ON s.id = sc.service_id AND s.profile_id = sc.profile_id
      LEFT JOIN profile_images pi ON pi.id = sc.image_id AND pi.is_active = 1 AND pi.lifecycle = 'confirmed'
      WHERE sc.id IN (${list}) AND sc.is_active = 1 AND sc.is_published = 1
        AND s.is_active = 1 AND p.profile_status = 'active'
        AND EXISTS (SELECT 1 FROM profile_specialties ps WHERE ps.profile_id = p.id
          AND ps.specialty_id = s.specialty_id AND ps.is_active = 1)`,
    `SELECT id, service_card_id, profile_id, storage_key, alt, sort_order, lifecycle, width, height
      FROM service_card_images WHERE service_card_id IN (${list}) AND lifecycle = 'confirmed'
      ORDER BY service_card_id, sort_order, created_at`,
  ]);
  const images = new Map<string, ProfileImage[]>();
  for (const row of imageRows) {
    const cardId = text(row, "service_card_id");
    images.set(cardId, [...(images.get(cardId) ?? []), image(row, "service")]);
  }
  const cards = rows.map((row): ServiceCard => {
    const id = text(row, "id");
    const reviewCount = number(row, "review_count");
    const cardImages = images.get(id) ?? [];
    const legacyKey = nullableText(row, "image_storage_key");
    return {
      id,
      profileId: text(row, "profile_id"),
      providerSlug: text(row, "provider_slug"),
      providerName: text(row, "provider_name"),
      providerIcon: text(row, "provider_icon"),
      providerVerified: text(row, "verification_status") === "verified",
      providerRating: reviewCount > 0 ? number(row, "rating_sum") / reviewCount : null,
      providerReviewCount: reviewCount,
      providerLocationId: text(row, "provider_location_id") || "uruguay",
      specialtyId: text(row, "specialty_id"),
      serviceId: text(row, "service_id"),
      serviceName: text(row, "service_name"),
      slug: text(row, "slug"),
      title: text(row, "title"),
      description: text(row, "description"),
      priceKind: text(row, "price_kind") as ServiceCardPriceKind,
      priceMinCents: row.price_min_cents === null ? null : number(row, "price_min_cents"),
      priceMaxCents: row.price_max_cents === null ? null : number(row, "price_max_cents"),
      currency: "UYU",
      tier: text(row, "tier") as ServiceCardTier,
      durationMinMinutes: row.duration_min_minutes === null ? null : number(row, "duration_min_minutes"),
      durationMaxMinutes: row.duration_max_minutes === null ? null : number(row, "duration_max_minutes"),
      serviceMode: text(row, "service_mode") as ServiceModeCode,
      paymentMethod: nullableText(row, "payment_method") as PaymentMethod | null,
      schedule: text(row, "schedule"),
      imageId: nullableText(row, "image_id"),
      imageUrl: cardImages[0]?.url ?? (legacyKey ? `/media/${legacyKey}` : null),
      images: cardImages,
      isPublished: boolean(row, "is_published"),
      isActive: boolean(row, "is_active"),
      sortOrder: number(row, "sort_order"),
    };
  });
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}

const [firstProfiles = [], topProfiles = [], firstCards = []] = query([
  "SELECT id FROM profiles WHERE profile_status = 'active' ORDER BY created_at, id LIMIT 12",
  "SELECT id FROM profiles WHERE profile_status = 'active' AND review_count > 0 ORDER BY CAST(rating_sum AS REAL) / review_count DESC, review_count DESC, id LIMIT 100",
  `SELECT sc.id FROM service_cards sc JOIN profiles p ON p.id = sc.profile_id
    JOIN services s ON s.id = sc.service_id AND s.profile_id = sc.profile_id
    WHERE sc.is_active = 1 AND sc.is_published = 1 AND s.is_active = 1
      AND p.profile_status = 'active' AND EXISTS (SELECT 1 FROM profile_specialties ps
        WHERE ps.profile_id = p.id AND ps.specialty_id = s.specialty_id AND ps.is_active = 1)
    ORDER BY sc.created_at, sc.id LIMIT 12`,
]);

const featuredIds = MARKETPLACE_SHOWCASE.home.featuredProviderIds.length
  ? [...MARKETPLACE_SHOWCASE.home.featuredProviderIds]
  : firstProfiles.slice(0, 4).map((row) => text(row, "id"));
const featuredSet = new Set(featuredIds);
const topRatedIds = MARKETPLACE_SHOWCASE.home.topRatedProviderIds.length
  ? [...MARKETPLACE_SHOWCASE.home.topRatedProviderIds]
  : topProfiles.map((row) => text(row, "id")).filter((id) => !featuredSet.has(id)).slice(0, 4);
const configuredSearch = MARKETPLACE_SHOWCASE.search.items;
const searchProfileIds = configuredSearch.length
  ? configuredSearch.filter((item) => item.kind === "profile").map((item) => item.id)
  : firstProfiles.map((row) => text(row, "id"));
const searchCardIds = configuredSearch.length
  ? configuredSearch.filter((item) => item.kind === "service").map((item) => item.id)
  : firstCards.map((row) => text(row, "id"));

const profileIds = [...new Set([...featuredIds, ...topRatedIds, ...searchProfileIds])];
const profiles = loadProfiles(profileIds);
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const cards = loadCards(searchCardIds);
const cardById = new Map(cards.map((card) => [card.id, card]));
const searchItems: Array<
  | { kind: "profile"; profile: Profile }
  | { kind: "service"; card: ServiceCard }
> = [];
const selection = configuredSearch.length
  ? configuredSearch
  : [
      ...searchProfileIds.map((id) => ({ kind: "profile" as const, id })),
      ...searchCardIds.map((id) => ({ kind: "service" as const, id })),
    ];
for (const item of selection) {
  if (item.kind === "profile") {
    const profile = profileById.get(item.id);
    if (profile) searchItems.push({ kind: "profile", profile });
  } else {
    const card = cardById.get(item.id);
    if (card) searchItems.push({ kind: "service", card });
  }
}

const snapshot = {
  selection: MARKETPLACE_SHOWCASE,
  home: {
    featured: featuredIds.flatMap((id) => profileById.has(id) ? [profileById.get(id)!] : []),
    topRated: topRatedIds.flatMap((id) => profileById.has(id) ? [profileById.get(id)!] : []),
  },
  search: searchItems,
};

writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Showcase ${remote ? "remoto" : "local"} generado: ${snapshot.home.featured.length} destacados, ${snapshot.home.topRated.length} mejor calificados y ${snapshot.search.length} candidatos de búsqueda.`);
