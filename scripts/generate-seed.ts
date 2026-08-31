/**
 * Genera los datos de prueba de desarrollo.
 *
 * Produce dos archivos:
 *   seeds/providers.json  — los datos, legibles y reutilizables
 *   seeds/dev-seed.sql    — el mismo contenido listo para D1
 *
 * El JSON es la fuente: el SQL se deriva de él. Así los datos se pueden
 * inspeccionar, versionar o cargar desde otro lado sin volver a generarlos.
 *
 * Los nombres, empresas y teléfonos salen de Faker con locale español; el
 * rubro y la ubicación salen de la taxonomía y del Master Data geográfico
 * reales, de modo que toda referencia existe por construcción.
 *
 * Es determinista: con la misma semilla, dos corridas dan archivos idénticos
 * y el seed no ensucia los diffs.
 *
 * Uso: npm run seed:generate
 */
import { writeFileSync } from "node:fs";

import { Faker, base, en, es } from "@faker-js/faker";

import { CATEGORIES } from "../src/data/categories";
import { LOCATIONS, listAreas, locationLabel } from "../src/data/locations";
import { slugify } from "../src/lib/slug";
import type { PaymentMethod, ProviderKind, ProviderStatus } from "../src/types";

const SEED = 20260831;
const MIN_PER_SUBCATEGORY = 5;
const MAX_PER_SUBCATEGORY = 10;
/** Proporción de perfiles que son empresas; el resto, independientes. */
const BUSINESS_RATIO = 0.35;

// `es` para nombres y empresas; `en` y `base` cubren lo que el locale español
// no define (Faker cae al siguiente de la lista).
const faker = new Faker({ locale: [es, en, base] });
faker.seed(SEED);

const PAYMENTS: PaymentMethod[] = [
  "Efectivo", "Transferencia", "Débito", "Crédito", "Otros",
];

const SCHEDULES = [
  "Lunes a viernes · 9:00 a 18:00",
  "Lunes a sábado · 8:00 a 20:00",
  "Lunes a viernes · 8:00 a 17:00 · Sábados hasta 13:00",
  "Todos los días · 7:00 a 22:00",
  "24 horas, todos los días",
  "Martes a sábado · 10:00 a 19:00",
  "Lunes a viernes · 10:00 a 19:00 · También remoto",
  "Con hora previa",
];

/** Complementos de servicio, para que no todos ofrezcan lo mismo. */
const SERVICE_QUALIFIERS = [
  "a domicilio", "para empresas", "de urgencia", "con garantía",
  "presupuesto sin cargo", "en el día",
];

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

type SeedProvider = {
  userId: string;
  email: string;
  providerId: string;
  slug: string;
  name: string;
  kind: ProviderKind;
  description: string;
  icon: string;
  categoryId: string;
  subcategoryId: string;
  locationId: string;
  serviceAreaIds: string[];
  services: string[];
  paymentMethods: PaymentMethod[];
  phone: string;
  whatsapp: string;
  schedule: string;
  status: ProviderStatus;
  featured: boolean;
  verified: boolean;
  reviews: SeedReview[];
};

/** Se prefieren ubicaciones con barrio: dan etiquetas más específicas. */
const LOCATION_POOL = [
  ...LOCATIONS.filter((location) => location.area),
  ...LOCATIONS.filter((location) => !location.area),
];

const usedSlugs = new Set<string>();

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

/** Celular uruguayo: 09X XXX XXX. Faker da formatos españoles, no sirven acá. */
function uruguayanMobile(): string {
  const digits = `9${faker.number.int({ min: 1, max: 9 })}${faker.string.numeric(6)}`;
  return `0${digits}`;
}

/** Zonas de trabajo: la propia más otras de la misma localidad. */
function serviceAreasFor(locationId: string): string[] {
  const own = LOCATIONS.find((location) => location.id === locationId)!;
  const siblings = listAreas(own.department, own.locality)
    .filter((location) => location.id !== locationId)
    .map((location) => location.id);

  return [
    locationId,
    ...faker.helpers.arrayElements(siblings, { min: 0, max: 3 }),
  ];
}

function buildProvider(
  category: (typeof CATEGORIES)[number],
  subcategory: (typeof CATEGORIES)[number]["subcategories"][number],
  index: number,
): SeedProvider {
  const isBusiness = faker.datatype.boolean({ probability: BUSINESS_RATIO });

  // Para empresas, el nombre de Faker se acorta y se ancla al rubro: sale algo
  // como "Peluquería Angulo" en vez de una razón social larguísima.
  const name = isBusiness
    ? `${subcategory.name.split(/[ ,]/)[0]} ${faker.person.lastName()}${
        faker.datatype.boolean({ probability: 0.3 }) ? " S.R.L." : ""
      }`
    // Nombre y apellido, sin los tratamientos ("Sr.", "Sta.") que agrega el
    // locale español: en un directorio de servicios suenan fuera de lugar.
    : `${faker.person.firstName()} ${faker.person.lastName()}`;

  const slug = uniqueSlug(name);
  const location = faker.helpers.arrayElement(LOCATION_POOL);

  const services = [
    subcategory.name,
    ...faker.helpers
      .arrayElements(SERVICE_QUALIFIERS, { min: 1, max: 3 })
      .map((qualifier) => `${subcategory.name} ${qualifier}`),
  ];

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
      .between({ from: "2026-01-01T00:00:00.000Z", to: "2026-08-25T00:00:00.000Z" })
      .toISOString(),
  }));

  const description = isBusiness
    ? `${name} ofrece servicios de ${subcategory.name.toLowerCase()} en ${locationLabel(location)} y alrededores. Equipo propio, presupuesto sin cargo y trabajos con garantía.`
    : `${subcategory.name} en ${locationLabel(location)}. Trabajo prolijo, precios claros y respuesta rápida. Consultá sin compromiso por WhatsApp.`;

  const mobile = uruguayanMobile();

  return {
    userId: `seed-user-${slug}`,
    email: `${slug}@ejemplo.uy`,
    providerId: `seed-prov-${slug}`,
    slug,
    name,
    kind: isBusiness ? "business" : "individual",
    description,
    icon: category.icon,
    categoryId: category.id,
    subcategoryId: subcategory.id,
    locationId: location.id,
    serviceAreaIds: serviceAreasFor(location.id),
    services,
    paymentMethods: faker.helpers.arrayElements(PAYMENTS, { min: 1, max: 4 }),
    phone: mobile,
    whatsapp: `598${mobile.slice(1)}`,
    schedule: faker.helpers.arrayElement(SCHEDULES),
    // El primero de cada subcategoría siempre se publica, así ninguna queda
    // vacía; del resto, unos pocos quedan en borrador para probar ese estado.
    status:
      index === 0 || !faker.datatype.boolean({ probability: 0.08 })
        ? "active"
        : "draft",
    featured: faker.datatype.boolean({ probability: 0.12 }),
    verified: faker.datatype.boolean({ probability: 0.45 }),
    reviews,
  };
}

const providers: SeedProvider[] = [];

for (const category of CATEGORIES) {
  for (const subcategory of category.subcategories) {
    const total = faker.number.int({
      min: MIN_PER_SUBCATEGORY,
      max: MAX_PER_SUBCATEGORY,
    });
    for (let index = 0; index < total; index += 1) {
      providers.push(buildProvider(category, subcategory, index));
    }
  }
}

writeFileSync(
  "seeds/providers.json",
  `${JSON.stringify(providers, null, 2)}\n`,
  "utf8",
);

// --- SQL derivado del JSON ---------------------------------------------------

/** Escapa comillas simples para literales SQL. */
function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const businesses = providers.filter((p) => p.kind === "business").length;
const NOW = "2026-08-31T12:00:00.000Z";

const lines: string[] = [
  "-- Datos de prueba para desarrollo local. GENERADO: no editar a mano.",
  "-- Regenerar con: npm run seed:generate",
  "--",
  `-- ${providers.length} proveedores sobre ${CATEGORIES.flatMap((c) => c.subcategories).length} subcategorías`,
  `-- ${businesses} empresas · ${providers.length - businesses} independientes`,
  "--",
  "-- NO debe ejecutarse en producción: borra el contenido de las tablas.",
  "",
  "DELETE FROM provider_payment_methods;",
  "DELETE FROM provider_service_areas;",
  "DELETE FROM provider_services;",
  "DELETE FROM provider_images;",
  "DELETE FROM reviews;",
  "DELETE FROM providers;",
  "DELETE FROM sessions;",
  "DELETE FROM users;",
  "",
];

for (const provider of providers) {
  lines.push(
    `INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at, updated_at) VALUES (${sql(provider.userId)}, ${sql(provider.email)}, NULL, ${sql(provider.name)}, 'provider', 1, ${sql(NOW)}, ${sql(NOW)});`,
  );

  const ratingSum = provider.reviews.reduce((total, r) => total + r.rating, 0);

  lines.push(
    `INSERT INTO providers (id, user_id, slug, name, kind, description, icon, category_id, subcategory_id, location_id, phone, whatsapp, schedule, status, featured, verified, rating_sum, review_count, created_at, updated_at) VALUES (${sql(provider.providerId)}, ${sql(provider.userId)}, ${sql(provider.slug)}, ${sql(provider.name)}, ${sql(provider.kind)}, ${sql(provider.description)}, ${sql(provider.icon)}, ${sql(provider.categoryId)}, ${sql(provider.subcategoryId)}, ${sql(provider.locationId)}, ${sql(provider.phone)}, ${sql(provider.whatsapp)}, ${sql(provider.schedule)}, ${sql(provider.status)}, ${provider.featured ? 1 : 0}, ${provider.verified ? 1 : 0}, ${ratingSum}, ${provider.reviews.length}, ${sql(NOW)}, ${sql(NOW)});`,
  );

  provider.services.forEach((service, position) => {
    lines.push(
      `INSERT INTO provider_services (provider_id, name, position) VALUES (${sql(provider.providerId)}, ${sql(service)}, ${position});`,
    );
  });

  for (const areaId of provider.serviceAreaIds) {
    lines.push(
      `INSERT INTO provider_service_areas (provider_id, location_id) VALUES (${sql(provider.providerId)}, ${sql(areaId)});`,
    );
  }

  for (const method of provider.paymentMethods) {
    lines.push(
      `INSERT INTO provider_payment_methods (provider_id, method) VALUES (${sql(provider.providerId)}, ${sql(method)});`,
    );
  }

  provider.reviews.forEach((review, index) => {
    lines.push(
      `INSERT INTO reviews (id, provider_id, author_id, author_name, rating, comment, status, created_at) VALUES (${sql(`${provider.providerId}-r${index}`)}, ${sql(provider.providerId)}, NULL, ${sql(review.authorName)}, ${review.rating}, ${sql(review.comment)}, 'published', ${sql(review.createdAt)});`,
    );
  });
}

writeFileSync("seeds/dev-seed.sql", `${lines.join("\n")}\n`, "utf8");

console.log("Generado:");
console.log("  seeds/providers.json");
console.log("  seeds/dev-seed.sql");
console.log();
console.log(`  proveedores:     ${providers.length}`);
console.log(`  empresas:        ${businesses}`);
console.log(`  independientes:  ${providers.length - businesses}`);
console.log(`  publicados:      ${providers.filter((p) => p.status === "active").length}`);
console.log(`  destacados:      ${providers.filter((p) => p.featured).length}`);
console.log(`  verificados:     ${providers.filter((p) => p.verified).length}`);
console.log(`  sin opiniones:   ${providers.filter((p) => p.reviews.length === 0).length}`);
console.log(`  opiniones:       ${providers.reduce((t, p) => t + p.reviews.length, 0)}`);
console.log(`  sentencias SQL:  ${lines.filter((l) => l.startsWith("INSERT")).length}`);
