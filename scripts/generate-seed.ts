/**
 * Genera los datos de prueba de desarrollo.
 *
 * Produce tres archivos:
 *   seeds/providers.json        — los datos, legibles y reutilizables
 *   seeds/dev-seed.sql          — el mismo contenido listo para D1
 *   seeds/set-dev-password.sql  — sólo la contraseña, para una base ya cargada
 *
 * El JSON es la fuente: el SQL se deriva de él. Así los datos se pueden
 * inspeccionar, versionar o cargar desde otro lado sin volver a generarlos.
 *
 * Los catálogos —geografía, taxonomía y horarios— no se inventan acá: salen de
 * `src/data/*.json`, que a su vez generan los otros scripts desde `docs/data`.
 * El seed carga esos catálogos en sus tablas y después cuelga los perfiles de
 * ellos, así toda referencia existe por construcción.
 *
 * Los perfiles respetan las reglas de negocio que el propio formulario aplica:
 * los cupos del plan (BR-006), la normalización de áreas (TR-018), la
 * ubicación física sólo cuando se atiende en el negocio (BR-015) y los
 * servicios colgados de una especialidad ya elegida (BR-010). Un seed que las
 * violara mostraría estados que la aplicación no puede producir.
 *
 * Es determinista: con la misma semilla, dos corridas dan archivos idénticos
 * y el seed no ensucia los diffs.
 *
 * Uso: npm run seed:generate
 */
import { writeFileSync } from "node:fs";

import { Faker, base, en, es } from "@faker-js/faker";

import { LOCATIONS, listLocalities, locationLabel } from "../src/data/locations";
import { SCHEDULE_SUGGESTIONS } from "../src/data/schedules";
import {
  SERVICE_SECTORS,
  SPECIALTIES,
  suggestionsFor,
} from "../src/data/taxonomy";
import { hashPasswordWithSalt } from "../src/lib/password";
import { slugify } from "../src/lib/slug";
import type {
  PaymentMethod,
  PlanId,
  ProfileStatus,
  ProfileType,
  ServiceCardPriceKind,
  ServiceCardTier,
  ServiceModeCode,
} from "../src/types";

const SEED = 20260831;

/**
 * Contraseña única para todas las cuentas de prueba, para poder entrar con
 * cualquiera de ellas desde el login.
 *
 * SÓLO para datos de prueba: es pública y está en el repositorio. Estos
 * usuarios no deben existir en producción — el seed empieza borrando las
 * tablas justamente porque no está pensado para correr allí.
 */
const SEED_PASSWORD = "admin.123";

/**
 * Sal fija: el generador es determinista y una sal al azar cambiaría todas las
 * líneas de `users` en cada corrida. Reusar la sal es inaceptable en
 * producción, pero aquí la contraseña ya es pública de todos modos.
 */
const SEED_PASSWORD_SALT = new Uint8Array(
  Array.from({ length: 16 }, (_, i) => (i * 17 + 3) % 256),
);

/**
 * Reparto de planes en los datos de prueba.
 *
 * Se mezclan los tres para poder ver el comportamiento de los límites y del
 * upsell; sin variedad no habría forma de probar la degradación de BR-009.
 */
const PLAN_WEIGHTS: { weight: number; value: PlanId }[] = [
  { weight: 60, value: "cobre" },
  { weight: 28, value: "gold" },
  { weight: 12, value: "platinum" },
];

/**
 * Los cupos de BR-006. `null` es "sin límite" y por eso el tipo lo admite: no
 * es lo mismo que un número grande.
 *
 * Están acá y no leídos de la base porque el seed genera el SQL sin conectarse
 * a nada. Si la matriz cambia, cambia en la migración y acá.
 */
const PLAN_CAPS: Record<
  PlanId,
  {
    sectors: number;
    specialties: number;
    services: number;
    locations: number | null;
    gallery: number;
    serviceCards: number;
  }
> = {
  cobre: { sectors: 1, specialties: 2, services: 10, locations: 1, gallery: 0, serviceCards: 2 },
  gold: { sectors: 2, specialties: 6, services: 25, locations: 5, gallery: 5, serviceCards: 10 },
  platinum: {
    sectors: 3,
    specialties: 12,
    services: 50,
    locations: null,
    gallery: 20,
    serviceCards: 20,
  },
};

const SERVICE_MODES: ServiceModeCode[] = ["at_customer", "at_business", "remote"];

const PAYMENTS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
  "other",
];

/** Cuántos perfiles se generan por especialidad. */
const MIN_PER_SPECIALTY = 3;
const MAX_PER_SPECIALTY = 6;
/** Proporción de perfiles que son empresas; el resto, independientes. */
const BUSINESS_RATIO = 0.35;

// `es` para nombres y empresas; `en` y `base` cubren lo que el locale español
// no define (Faker cae al siguiente de la lista).
const faker = new Faker({ locale: [es, en, base] });
faker.seed(SEED);

const REVIEW_COMMENTS = [
  "Excelente trabajo, muy prolijo y en el plazo que había dicho.",
  "Cumplió con lo presupuestado y dejó todo limpio. Recomendable.",
  "Llegó puntual y resolvió el problema en el momento. Muy conforme.",
  "Buena atención y precio justo. Volvería a contratarlo.",
  "Trabajo impecable. Explicó bien todo antes de empezar.",
  "Respondió rápido por WhatsApp y coordinamos para el mismo día.",
  "Muy profesional. Se nota la experiencia en el rubro.",
  "Buen servicio en general, aunque demoró un poco más de lo previsto.",
  "Resolvió lo que otros no pudieron. Muy agradecido.",
  "Atención cordial y resultado tal como esperaba.",
];

type SeedReview = {
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type SeedProfileLocation = {
  id: string;
  locationId: string;
  name: string | null;
  address: string | null;
  isPrimary: boolean;
};

type SeedService = {
  id: string;
  specialtyId: string;
  name: string;
  sortOrder: number;
};

type SeedServiceCard = {
  id: string;
  specialtyId: string;
  slug: string;
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
  isPublished: boolean;
  sortOrder: number;
};

type SeedProfile = {
  userId: string;
  email: string;
  profileId: string;
  slug: string;
  name: string;
  type: ProfileType;
  description: string;
  icon: string;
  contactEmail: string;
  phone: string;
  phoneE164: string;
  whatsappEnabled: boolean;
  /** Las especialidades elegidas; los rubros se derivan de ellas (BR-010). */
  specialtyIds: string[];
  services: SeedService[];
  serviceCards: SeedServiceCard[];
  serviceModes: ServiceModeCode[];
  serviceAreaIds: string[];
  locations: SeedProfileLocation[];
  paymentMethods: PaymentMethod[];
  scheduleEntries: string[];
  profileStatus: ProfileStatus;
  verificationStatus: "not_requested" | "verified";
  planId: PlanId;
  reviews: SeedReview[];
};

/**
 * Las localidades, que es lo único que puede ser una ubicación física.
 *
 * Ni el país ni un departamento sirven (BR-015): un local tiene dirección, y
 * una dirección cae siempre dentro de una localidad.
 */
const LOCALITIES = LOCATIONS.filter((l) => l.type === "locality");

const usedSlugs = new Set<string>();
const usedServiceCardSlugs = new Set<string>();

/** BR-005: si dos perfiles generan el mismo slug, se desambigua con sufijo. */
function uniqueSlug(base: string): string {
  const root = slugify(base) || "profesional";
  let candidate = root;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function uniqueServiceCardSlug(base: string): string {
  const root = slugify(base) || "servicio";
  let candidate = root;
  let n = 2;
  while (usedServiceCardSlugs.has(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  usedServiceCardSlugs.add(candidate);
  return candidate;
}

/** Celular uruguayo: 09X XXX XXX. Faker da formatos españoles, no sirven acá. */
function uruguayanMobile(): string {
  const digits = `9${faker.number.int({ min: 1, max: 9 })}${faker.string.numeric(6)}`;
  return `0${digits}`;
}

/**
 * Áreas de servicio ya normalizadas (TR-018): o el país solo, o un
 * departamento con localidades de otros departamentos.
 *
 * Se arma directamente en forma válida en vez de generar cualquier cosa y
 * después normalizar: así el JSON del seed muestra exactamente lo que quedaría
 * guardado.
 */
function serviceAreasFor(locality: (typeof LOCALITIES)[number]): string[] {
  // Cobertura nacional: reemplaza cualquier otra selección.
  if (faker.datatype.boolean({ probability: 0.08 })) return ["uruguay"];

  const department = locality.parentId!;

  // El departamento entero: sus localidades serían redundantes.
  if (faker.datatype.boolean({ probability: 0.3 })) {
    const others = faker.helpers.arrayElements(
      LOCALITIES.filter((l) => l.parentId !== department),
      { min: 0, max: 2 },
    );
    return [department, ...others.map((l) => l.id)];
  }

  // Localidades sueltas del mismo departamento, empezando por la propia.
  const siblings = listLocalities(department).filter(
    (l) => l.id !== locality.id,
  );
  return [
    locality.id,
    ...faker.helpers.arrayElements(siblings, { min: 0, max: 3 }).map((l) => l.id),
  ];
}

function buildProfile(
  specialty: (typeof SPECIALTIES)[number],
  index: number,
): SeedProfile {
  const sector = SERVICE_SECTORS.find((s) => s.id === specialty.serviceSectorId)!;
  const isBusiness = faker.datatype.boolean({ probability: BUSINESS_RATIO });

  // Para empresas, el nombre de Faker se acorta y se ancla a la especialidad:
  // sale algo como "Peluquería Angulo" en vez de una razón social larguísima.
  const name = isBusiness
    ? `${specialty.name.split(/[ ,]/)[0]} ${faker.person.lastName()}${
        faker.datatype.boolean({ probability: 0.3 }) ? " S.R.L." : ""
      }`
    : // Nombre y apellido, sin los tratamientos ("Sr.", "Sta.") que agrega el
      // locale español: en un directorio de servicios suenan fuera de lugar.
      `${faker.person.firstName()} ${faker.person.lastName()}`;

  const slug = uniqueSlug(name);
  const locality = faker.helpers.arrayElement(LOCALITIES);
  const planId = faker.helpers.weightedArrayElement(PLAN_WEIGHTS);
  const caps = PLAN_CAPS[planId];

  /*
   * Especialidades: la propia y, si el plan da, otras del mismo rubro.
   *
   * Quedarse dentro del rubro no es casual: el tope de rubros de Cobre es 1, y
   * tomar especialidades de cualquier lado lo pasaría al primer intento.
   */
  const specialtyIds = [
    specialty.id,
    ...faker.helpers
      .arrayElements(
        SPECIALTIES.filter(
          (s) => s.serviceSectorId === sector.id && s.id !== specialty.id,
        ),
        { min: 0, max: Math.max(0, caps.specialties - 1) },
      )
      .map((s) => s.id),
  ].slice(0, caps.specialties);

  /*
   * Los servicios salen del catálogo de la especialidad y se reparten entre
   * las elegidas. Cada uno cuelga de una especialidad que el perfil tiene, que
   * es lo que exige la FK compuesta de `services`.
   */
  const services: SeedService[] = [];
  for (const specialtyId of specialtyIds) {
    const catalog = suggestionsFor(specialtyId);
    if (catalog.length === 0) continue;

    const picked = faker.helpers.arrayElements(catalog, {
      min: 2,
      max: Math.min(6, catalog.length),
    });

    for (const suggestion of picked) {
      if (services.length >= caps.services) break;
      services.push({
        id: `seed-svc-${slug}-${services.length}`,
        specialtyId,
        name: suggestion.name,
        sortOrder: services.length,
      });
    }
  }

  // BR-017: una o varias. Con más de una, la ficha muestra atención híbrida.
  const serviceModes = faker.helpers.arrayElements(SERVICE_MODES, {
    min: 1,
    max: 3,
  });

  /*
   * BR-015: la ubicación física sólo tiene sentido si se atiende en el
   * negocio, y ahí es obligatoria para publicar (BR-003). Quien trabaja a
   * domicilio o a distancia se publica sin local.
   */
  const atBusiness = serviceModes.includes("at_business");
  const locationCount = atBusiness
    ? Math.min(
        faker.number.int({ min: 1, max: 3 }),
        caps.locations ?? Number.MAX_SAFE_INTEGER,
      )
    : 0;

  const locations: SeedProfileLocation[] = Array.from(
    { length: locationCount },
    (_, i) => ({
      id: `seed-loc-${slug}-${i}`,
      /*
       * La primera queda en la localidad del perfil; las demás, en cualquier
       * otra localidad.
       *
       * Siempre una localidad y nunca un departamento (BR-015): un local está
       * en una dirección concreta, y "todo Canelones" no es un lugar donde se
       * pueda atender a alguien. Antes se sorteaba entre localidades y
       * departamentos, y el seed generaba locales imposibles.
       */
      locationId:
        i === 0 ? locality.id : faker.helpers.arrayElement(LOCALITIES).id,
      name: i === 0 ? null : `Sucursal ${i + 1}`,
      address: `${faker.location.street()} ${faker.number.int({ min: 100, max: 4999 })}`,
      // BR-015: una sola principal.
      isPrimary: i === 0,
    }),
  );

  const reviewCount = faker.datatype.boolean({ probability: 0.2 })
    ? 0
    : faker.number.int({ min: 1, max: 9 });

  const reviews: SeedReview[] = Array.from({ length: reviewCount }, () => ({
    authorName: `${faker.person.firstName()} ${faker.person.lastName().charAt(0)}.`,
    // Sesgo hacia buenas calificaciones, con algunas medias.
    rating: faker.helpers.weightedArrayElement([
      { weight: 70, value: 5 },
      { weight: 22, value: 4 },
      { weight: 8, value: 3 },
    ]),
    comment: faker.helpers.arrayElement(REVIEW_COMMENTS),
    createdAt: faker.date
      .between({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-08-25T00:00:00.000Z",
      })
      .toISOString(),
  }));

  const where = locationLabel(locality);
  const description = isBusiness
    ? `${name} ofrece servicios de ${specialty.name.toLowerCase()} en ${where} y alrededores. Equipo propio, presupuesto sin cargo y trabajos con garantía.`
    : `${specialty.name} en ${where}. Trabajo prolijo, precios claros y respuesta rápida. Consultá sin compromiso por WhatsApp.`;

  const mobile = uruguayanMobile();

  /*
   * BR-019: sólo Oro y Platino pueden pedir la insignia, y sólo se muestra
   * aprobada. En Cobre ni siquiera se solicita.
   */
  const verified =
    planId !== "cobre" && faker.datatype.boolean({ probability: 0.5 });

  const paymentMethods = faker.helpers.arrayElements(PAYMENTS, { min: 1, max: 4 });
  const scheduleEntries = faker.helpers.arrayElements(SCHEDULE_SUGGESTIONS, {
    min: 1,
    max: 4,
  });
  const profileStatus: ProfileStatus =
    index === 0 || !faker.datatype.boolean({ probability: 0.08 })
      ? "active"
      : "draft";

  /*
   * Algunas fichas reciben de 2 a 5 propuestas comparables. Cobre queda en
   * dos por su cupo; los demás planes no se llenan artificialmente hasta 10 o
   * 20, porque el seed busca variedad y no sólo probar el máximo.
   */
  const maxMockCards = Math.min(5, caps.serviceCards, services.length);
  const cardCount = maxMockCards >= 2 && faker.datatype.boolean({ probability: 0.45 })
    ? faker.number.int({ min: 2, max: maxMockCards })
    : 0;
  const serviceCards: SeedServiceCard[] = faker.helpers
    .arrayElements(services, cardCount)
    .map((service, order) => {
      const priceKind = faker.helpers.weightedArrayElement<ServiceCardPriceKind>([
        { weight: 20, value: "quote" },
        { weight: 35, value: "fixed" },
        { weight: 25, value: "from" },
        { weight: 20, value: "range" },
      ]);
      const basePrice = faker.number.int({ min: 8, max: 120 }) * 500 * 100;
      const priceMinCents = priceKind === "quote" ? null : basePrice;
      const priceMaxCents = priceKind === "range"
        ? basePrice + faker.number.int({ min: 2, max: 30 }) * 500 * 100
        : null;
      const durationMinMinutes = faker.helpers.arrayElement([30, 60, 90, 120, 240, 480]);

      return {
        id: `seed-card-${slug}-${order}`,
        specialtyId: service.specialtyId,
        slug: uniqueServiceCardSlug(`${service.name}-${slug}`),
        title: service.name,
        description: `${service.name} con alcance claro, materiales y tiempos a coordinar. Incluye asesoramiento previo y presupuesto detallado sin compromiso.`,
        priceKind,
        priceMinCents,
        priceMaxCents,
        tier: faker.helpers.weightedArrayElement<ServiceCardTier>([
          { weight: 25, value: "economy" },
          { weight: 55, value: "standard" },
          { weight: 20, value: "premium" },
        ]),
        durationMinMinutes,
        durationMaxMinutes: faker.datatype.boolean({ probability: 0.5 })
          ? durationMinMinutes + faker.helpers.arrayElement([30, 60, 120, 240])
          : null,
        serviceMode: faker.helpers.arrayElement(serviceModes),
        paymentMethod: faker.helpers.arrayElement(paymentMethods),
        schedule: faker.helpers.arrayElement(scheduleEntries),
        isPublished: faker.datatype.boolean({ probability: 0.9 }),
        sortOrder: order,
      };
    });

  return {
    userId: `seed-user-${slug}`,
    email: `${slug}@ejemplo.uy`,
    profileId: `seed-prof-${slug}`,
    slug,
    name,
    type: isBusiness ? "business" : "individual",
    description,
    icon: sector.icon,
    contactEmail: `${slug}@ejemplo.uy`,
    phone: mobile,
    phoneE164: `+598${mobile.slice(1)}`,
    whatsappEnabled: faker.datatype.boolean({ probability: 0.8 }),
    specialtyIds,
    services,
    serviceCards,
    serviceModes,
    serviceAreaIds: serviceAreasFor(locality),
    locations,
    paymentMethods,
    // BR-024: hasta diez líneas, tomadas de las sugerencias canónicas.
    scheduleEntries,
    // El primero de cada especialidad siempre se publica, así ninguna queda
    // vacía; del resto, unos pocos quedan en borrador para probar ese estado.
    profileStatus,
    verificationStatus: verified ? "verified" : "not_requested",
    planId,
    reviews,
  };
}

const profiles: SeedProfile[] = [];

for (const specialty of SPECIALTIES) {
  const total = faker.number.int({
    min: MIN_PER_SPECIALTY,
    max: MAX_PER_SPECIALTY,
  });
  for (let index = 0; index < total; index += 1) {
    profiles.push(buildProfile(specialty, index));
  }
}

writeFileSync(
  "seeds/providers.json",
  `${JSON.stringify(profiles, null, 2)}\n`,
  "utf8",
);

// --- SQL derivado del JSON ---------------------------------------------------

/** Escapa comillas simples para literales SQL. */
function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function nullable(value: string | null): string {
  return value === null ? "NULL" : sql(value);
}

const businesses = profiles.filter((p) => p.type === "business").length;
const NOW = "2026-09-05T12:00:00.000Z";

function buildSql(passwordHash: string): string {
  const lines: string[] = [
    "-- Datos de prueba para desarrollo local. GENERADO: no editar a mano.",
    "-- Regenerar con: npm run seed:generate",
    "--",
    `-- ${profiles.length} perfiles sobre ${SPECIALTIES.length} especialidades`,
    `-- ${businesses} empresas · ${profiles.length - businesses} independientes`,
    "--",
    "-- Incluye los catálogos (ubicaciones, rubros y especialidades): los",
    "-- perfiles los referencian por clave foránea y sin ellos no entran.",
    "--",
    `-- Todas las cuentas usan la contraseña ${SEED_PASSWORD} (sólo para pruebas).`,
    "--",
    "-- NO debe ejecutarse en producción: borra el contenido de las tablas.",
    "",
    // El orden importa: primero lo que depende, después lo dependido.
    "DELETE FROM review_reports;",
    "DELETE FROM reviews;",
    "DELETE FROM profile_schedule_entries;",
    "DELETE FROM service_card_images;",
    "DELETE FROM service_cards;",
    "DELETE FROM profile_images;",
    "DELETE FROM services;",
    "DELETE FROM professional_credentials;",
    "DELETE FROM profile_specialties;",
    "DELETE FROM profile_service_areas;",
    "DELETE FROM profile_locations;",
    "DELETE FROM profile_payment_methods;",
    "DELETE FROM profile_social_links;",
    "DELETE FROM profile_service_modes;",
    "DELETE FROM profiles;",
    "DELETE FROM sessions;",
    "DELETE FROM users;",
    "DELETE FROM specialties;",
    "DELETE FROM service_sectors;",
    "DELETE FROM locations;",
    "",
    "-- Catálogo geográfico (BR-014). Los padres van antes que los hijos.",
  ];

  /*
   * Las ubicaciones se insertan por nivel: `parent_id` es una FK contra la
   * misma tabla, así que una localidad antes que su departamento fallaría.
   */
  for (const type of ["country", "department", "locality"] as const) {
    for (const location of LOCATIONS.filter((l) => l.type === type)) {
      lines.push(
        `INSERT INTO locations (id, parent_id, type, name, slug, is_active, created_at, updated_at) VALUES (${sql(location.id)}, ${nullable(location.parentId)}, ${sql(location.type)}, ${sql(location.name)}, ${sql(location.slug)}, 1, ${sql(NOW)}, ${sql(NOW)});`,
      );
    }
  }

  lines.push("", "-- Taxonomía: rubros y especialidades (BR-010).");

  for (const sector of SERVICE_SECTORS) {
    lines.push(
      `INSERT INTO service_sectors (id, name, slug, description, icon, is_active, sort_order, created_at, updated_at) VALUES (${sql(sector.id)}, ${sql(sector.name)}, ${sql(sector.slug)}, NULL, ${sql(sector.icon)}, 1, ${sector.sortOrder}, ${sql(NOW)}, ${sql(NOW)});`,
    );
  }

  for (const specialty of SPECIALTIES) {
    lines.push(
      `INSERT INTO specialties (id, service_sector_id, name, slug, description, requires_professional_credential, is_active, sort_order, created_at, updated_at) VALUES (${sql(specialty.id)}, ${sql(specialty.serviceSectorId)}, ${sql(specialty.name)}, ${sql(specialty.slug)}, NULL, ${specialty.requiresProfessionalCredential ? 1 : 0}, 1, ${specialty.sortOrder}, ${sql(NOW)}, ${sql(NOW)});`,
    );
  }

  lines.push("", "-- Perfiles.");

  for (const profile of profiles) {
    lines.push(
      `INSERT INTO users (id, email, email_verified, role, password_hash, is_active, created_at, updated_at) VALUES (${sql(profile.userId)}, ${sql(profile.email)}, 1, 'provider', ${sql(passwordHash)}, 1, ${sql(NOW)}, ${sql(NOW)});`,
    );

    const ratingSum = profile.reviews.reduce((total, r) => total + r.rating, 0);

    lines.push(
      `INSERT INTO profiles (id, user_id, contact_email, phone, phone_e164, phone_verified_at, whatsapp_enabled, phone_public, name, slug, type, description, icon, profile_status, verification_status, plan_id, subscription_status, plan_expires_at, downgrade_plan_id, purge_excess_after, rating_sum, review_count, created_at, updated_at) VALUES (${sql(profile.profileId)}, ${sql(profile.userId)}, ${sql(profile.contactEmail)}, ${sql(profile.phone)}, ${sql(profile.phoneE164)}, NULL, ${profile.whatsappEnabled ? 1 : 0}, 1, ${sql(profile.name)}, ${sql(profile.slug)}, ${sql(profile.type)}, ${sql(profile.description)}, ${sql(profile.icon)}, ${sql(profile.profileStatus)}, ${sql(profile.verificationStatus)}, ${sql(profile.planId)}, 'active', NULL, NULL, NULL, ${ratingSum}, ${profile.reviews.length}, ${sql(NOW)}, ${sql(NOW)});`,
    );

    for (const mode of profile.serviceModes) {
      lines.push(
        `INSERT INTO profile_service_modes (profile_id, service_mode_id) VALUES (${sql(profile.profileId)}, ${sql(mode)});`,
      );
    }

    profile.specialtyIds.forEach((specialtyId, order) => {
      lines.push(
        `INSERT INTO profile_specialties (profile_id, specialty_id, is_active, sort_order, created_at, updated_at) VALUES (${sql(profile.profileId)}, ${sql(specialtyId)}, 1, ${order}, ${sql(NOW)}, ${sql(NOW)});`,
      );
    });

    // Después de `profile_specialties`: la FK compuesta las exige presentes.
    for (const service of profile.services) {
      lines.push(
        `INSERT INTO services (id, profile_id, specialty_id, name, is_active, sort_order, created_at, updated_at) VALUES (${sql(service.id)}, ${sql(profile.profileId)}, ${sql(service.specialtyId)}, ${sql(service.name)}, 1, ${service.sortOrder}, ${sql(NOW)}, ${sql(NOW)});`,
      );
    }

    for (const card of profile.serviceCards) {
      lines.push(
        `INSERT INTO service_cards (id, profile_id, specialty_id, slug, title, description, price_kind, price_min_cents, price_max_cents, currency, tier, duration_min_minutes, duration_max_minutes, service_mode, payment_method, schedule, image_id, is_published, is_active, sort_order, created_at, updated_at) VALUES (${sql(card.id)}, ${sql(profile.profileId)}, ${sql(card.specialtyId)}, ${sql(card.slug)}, ${sql(card.title)}, ${sql(card.description)}, ${sql(card.priceKind)}, ${card.priceMinCents ?? "NULL"}, ${card.priceMaxCents ?? "NULL"}, 'UYU', ${sql(card.tier)}, ${card.durationMinMinutes ?? "NULL"}, ${card.durationMaxMinutes ?? "NULL"}, ${sql(card.serviceMode)}, ${nullable(card.paymentMethod)}, ${sql(card.schedule)}, NULL, ${card.isPublished ? 1 : 0}, 1, ${card.sortOrder}, ${sql(NOW)}, ${sql(NOW)});`,
      );
    }

    for (const areaId of profile.serviceAreaIds) {
      lines.push(
        `INSERT INTO profile_service_areas (profile_id, location_id) VALUES (${sql(profile.profileId)}, ${sql(areaId)});`,
      );
    }

    for (const location of profile.locations) {
      lines.push(
        `INSERT INTO profile_locations (id, profile_id, location_id, name, address, is_primary, is_active, created_at, updated_at) VALUES (${sql(location.id)}, ${sql(profile.profileId)}, ${sql(location.locationId)}, ${nullable(location.name)}, ${nullable(location.address)}, ${location.isPrimary ? 1 : 0}, 1, ${sql(NOW)}, ${sql(NOW)});`,
      );
    }

    for (const method of profile.paymentMethods) {
      lines.push(
        `INSERT INTO profile_payment_methods (profile_id, method) VALUES (${sql(profile.profileId)}, ${sql(method)});`,
      );
    }

    profile.scheduleEntries.forEach((text, order) => {
      lines.push(
        `INSERT INTO profile_schedule_entries (id, profile_id, text, sort_order, created_at, updated_at) VALUES (${sql(`${profile.profileId}-h${order}`)}, ${sql(profile.profileId)}, ${sql(text)}, ${order}, ${sql(NOW)}, ${sql(NOW)});`,
      );
    });

    profile.reviews.forEach((review, index) => {
      lines.push(
        `INSERT INTO reviews (id, profile_id, consumer_user_id, author_name, rating, comment, status, created_at, updated_at) VALUES (${sql(`${profile.profileId}-r${index}`)}, ${sql(profile.profileId)}, NULL, ${sql(review.authorName)}, ${review.rating}, ${sql(review.comment)}, 'published', ${sql(review.createdAt)}, ${sql(review.createdAt)});`,
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  // El hash se calcula con la misma función que usa el login, así el seed no
  // puede quedar desalineado con el formato que espera `verifyPassword`.
  const passwordHash = await hashPasswordWithSalt(
    SEED_PASSWORD,
    SEED_PASSWORD_SALT,
  );

  const seedSql = buildSql(passwordHash);
  writeFileSync("seeds/dev-seed.sql", seedSql, "utf8");

  // Un archivo aparte para poner al día una base ya cargada (por ejemplo la
  // remota) sin volver a insertar todo.
  writeFileSync(
    "seeds/set-dev-password.sql",
    [
      "-- Pone la contraseña de prueba a todas las cuentas del seed.",
      "-- GENERADO: no editar a mano. Regenerar con: npm run seed:generate",
      "--",
      `-- Contraseña: ${SEED_PASSWORD}`,
      "--",
      "-- Sirve para una base ya cargada, sin volver a insertar los datos.",
      "-- Sólo toca los usuarios del seed (id LIKE 'seed-user-%').",
      "--",
      "-- Remoto: npm run db:password:remote",
      "",
      `UPDATE users SET password_hash = ${sql(passwordHash)}, updated_at = ${sql(NOW)} WHERE id LIKE 'seed-user-%';`,
      "",
    ].join("\n"),
    "utf8",
  );

  const services = profiles.reduce((t, p) => t + p.services.length, 0);
  const serviceCards = profiles.reduce((t, p) => t + p.serviceCards.length, 0);

  console.log("Generado:");
  console.log("  seeds/providers.json");
  console.log("  seeds/dev-seed.sql");
  console.log("  seeds/set-dev-password.sql");
  console.log();
  console.log(`  ubicaciones:     ${LOCATIONS.length}`);
  console.log(`  rubros:          ${SERVICE_SECTORS.length}`);
  console.log(`  especialidades:  ${SPECIALTIES.length}`);
  console.log(`  perfiles:        ${profiles.length}`);
  console.log(`  empresas:        ${businesses}`);
  console.log(`  independientes:  ${profiles.length - businesses}`);
  console.log(
    `  publicados:      ${profiles.filter((p) => p.profileStatus === "active").length}`,
  );
  console.log(
    `  verificados:     ${profiles.filter((p) => p.verificationStatus === "verified").length}`,
  );
  console.log(`  servicios:       ${services}`);
  console.log(`  cartas:          ${serviceCards}`);
  console.log(`  con cartas:      ${profiles.filter((p) => p.serviceCards.length > 0).length}`);
  console.log(
    `  con local:       ${profiles.filter((p) => p.locations.length > 0).length}`,
  );
  console.log(
    `  sin opiniones:   ${profiles.filter((p) => p.reviews.length === 0).length}`,
  );
  console.log(
    `  opiniones:       ${profiles.reduce((t, p) => t + p.reviews.length, 0)}`,
  );
  console.log(
    `  sentencias SQL:  ${seedSql.split("\n").filter((l) => l.startsWith("INSERT")).length}`,
  );
  for (const id of ["cobre", "gold", "platinum"] as PlanId[]) {
    const total = profiles.filter((p) => p.planId === id).length;
    console.log(`  plan ${id.padEnd(11)} ${total}`);
  }
  console.log(`  contraseña:      ${SEED_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
