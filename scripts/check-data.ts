/**
 * Verifica los catálogos generados y el seed contra las reglas de negocio.
 *
 * Se ejecuta con: npm run check:data
 *
 * Los catálogos se comprueban en memoria; el seed se carga en una base SQLite
 * temporal —con las migraciones reales y `PRAGMA foreign_keys = ON`— y se le
 * consultan las reglas que deben cumplirse. Cargarlo de verdad es lo único que
 * demuestra que las claves foráneas, los índices únicos y los CHECK aceptan lo
 * que el generador produce: revisar el JSON no prueba nada sobre el esquema.
 *
 * Las reglas se escriben como consultas que cuentan violaciones: el resultado
 * esperado es siempre 0. Así una regla nueva es una consulta más, y el que la
 * lee ve exactamente qué se está prohibiendo.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { LOCATIONS, listDepartments, normalizeServiceAreas } from "../src/data/locations";
import { SCHEDULE_SUGGESTIONS } from "../src/data/schedules";
import {
  SERVICE_SECTORS,
  SERVICE_SUGGESTIONS,
  SPECIALTIES,
} from "../src/data/taxonomy";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Catálogos generados
// ---------------------------------------------------------------------------

console.log("\nGeografía (BR-014, TR-032, TR-033)");

const departments = listDepartments();
const localities = LOCATIONS.filter((l) => l.type === "locality");
const roots = LOCATIONS.filter((l) => l.parentId === null);

check("19 departamentos", departments.length === 19, `${departments.length}`);
check("452 localidades", localities.length === 452, `${localities.length}`);
check("una sola raíz", roots.length === 1 && roots[0]!.id === "uruguay");
check(
  "IDs únicos",
  new Set(LOCATIONS.map((l) => l.id)).size === LOCATIONS.length,
);
check(
  "todo padre existe",
  LOCATIONS.every(
    (l) => l.parentId === null || LOCATIONS.some((p) => p.id === l.parentId),
  ),
);
check(
  "no hay cuarto nivel",
  localities.every((l) => {
    const parent = LOCATIONS.find((p) => p.id === l.parentId);
    return parent?.type === "department";
  }),
);
check("slugs no vacíos", LOCATIONS.every((l) => l.slug.length > 0));

console.log("\nNormalización de áreas (TR-018)");

check(
  "Uruguay reemplaza todo lo demás",
  JSON.stringify(normalizeServiceAreas(["uruguay", "canelones", "flores-trinidad"])) ===
    JSON.stringify(["uruguay"]),
);
check(
  "un departamento absorbe sus localidades",
  JSON.stringify(normalizeServiceAreas(["flores", "flores-trinidad"])) ===
    JSON.stringify(["flores"]),
);
check(
  "se combina un departamento con localidades de otros",
  normalizeServiceAreas(["flores", "canelones-atlantida"]).length === 2,
);

console.log("\nTaxonomía (BR-010 a BR-012, TR-020, TR-021)");

check("20 rubros", SERVICE_SECTORS.length === 20, `${SERVICE_SECTORS.length}`);
check("120 especialidades", SPECIALTIES.length === 120, `${SPECIALTIES.length}`);
check(
  "1174 servicios",
  SERVICE_SUGGESTIONS.length === 1174,
  `${SERVICE_SUGGESTIONS.length}`,
);
check(
  "IDs de servicio únicos",
  new Set(SERVICE_SUGGESTIONS.map((s) => s.id)).size ===
    SERVICE_SUGGESTIONS.length,
);
check(
  "toda especialidad pertenece a un rubro existente",
  SPECIALTIES.every((s) =>
    SERVICE_SECTORS.some((sector) => sector.id === s.serviceSectorId),
  ),
);
check(
  "todo servicio cuelga de una especialidad existente",
  SERVICE_SUGGESTIONS.every((s) =>
    SPECIALTIES.some((sp) => sp.id === s.specialtyId),
  ),
);
check(
  "el rubro del servicio coincide con el de su especialidad",
  SERVICE_SUGGESTIONS.every((s) => {
    const specialty = SPECIALTIES.find((sp) => sp.id === s.specialtyId);
    return specialty?.serviceSectorId === s.serviceSectorId;
  }),
);
check(
  "salud es un rubro regulado (BR-020)",
  SPECIALTIES.filter((s) => s.serviceSectorId === "salud").every(
    (s) => s.requiresProfessionalCredential,
  ),
);
check(
  "contabilidad, legal y seguros son reguladas (BR-020)",
  ["contabilidad", "legal", "seguros"].every(
    (slug) =>
      SPECIALTIES.find((s) => s.id === `servicios-profesionales-${slug}`)
        ?.requiresProfessionalCredential === true,
  ),
);
check(
  "consultoría no es regulada",
  SPECIALTIES.find((s) => s.id === "servicios-profesionales-consultoria")
    ?.requiresProfessionalCredential === false,
);

console.log("\nSugerencias de horarios (BR-024, TR-024)");

check("hay sugerencias", SCHEDULE_SUGGESTIONS.length > 0);
check(
  "es un string[] sin objetos",
  SCHEDULE_SUGGESTIONS.every((s) => typeof s === "string"),
);
check(
  "todas miden entre 3 y 120 caracteres",
  SCHEDULE_SUGGESTIONS.every((s) => s.length >= 3 && s.length <= 120),
);
check(
  "ninguna arrastra su alias",
  SCHEDULE_SUGGESTIONS.every((s) => !s.includes("alias:")),
);
check(
  "sin duplicados",
  new Set(SCHEDULE_SUGGESTIONS.map((s) => s.toLowerCase())).size ===
    SCHEDULE_SUGGESTIONS.length,
);

// ---------------------------------------------------------------------------
// Esquema y seed
// ---------------------------------------------------------------------------

console.log("\nMigraciones y seed");

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");

let schemaOk = true;
for (const file of readdirSync("migrations").sort()) {
  try {
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  } catch (error) {
    schemaOk = false;
    check(`migración ${file}`, false, (error as Error).message);
    break;
  }
}
if (schemaOk) check("las migraciones aplican en orden", true);

if (schemaOk) {
  const consumerRepository = readFileSync(
    "src/infrastructure/d1-consumer-repository.ts",
    "utf8",
  );
  check(
    "las consultas de sesión de Google usan el esquema migrado",
    consumerRepository.includes(
      "(id, consumer_user_id, expires_at, created_at)",
    ) &&
      consumerRepository.includes(
        "SELECT consumer_user_id FROM consumer_sessions",
      ) &&
      !consumerRepository.includes("SELECT user_id FROM consumer_sessions"),
  );
}

let seedOk = false;
if (schemaOk) {
  try {
    const seed = readFileSync("seeds/dev-seed.sql", "utf8");
    db.exec(seed);
    // Repoblar una base existente es el caso de `db:seed:local` y
    // `db:seed:remote`. Ejecutarlo dos veces descubre DELETE en un orden
    // incompatible con FKs que una primera carga sobre tablas vacías oculta.
    db.exec(seed);
    seedOk = true;
    check("el seed carga y se puede recargar con las claves foráneas activas", true);
  } catch (error) {
    check(
      "el seed carga y se puede recargar con las claves foráneas activas",
      false,
      (error as Error).message,
    );
  }
}

if (seedOk) {
  check(
    "sin violaciones de integridad referencial",
    db.prepare("PRAGMA foreign_key_check").all().length === 0,
  );

  /** Cuenta violaciones de una regla. El resultado esperado es siempre 0. */
  const violations = (sql: string): number =>
    (db.prepare(sql).get() as { n: number }).n;

  console.log("\nReglas de negocio sobre el seed");

  const rules: Array<[string, string]> = [
    [
      "BR-006 — límites de cartas configurados por plan",
      `SELECT count(*) n FROM plans WHERE
         (id = 'cobre' AND max_service_cards <> 2)
         OR (id = 'gold' AND max_service_cards <> 10)
         OR (id = 'platinum' AND max_service_cards <> 20)`,
    ],
    [
      "BR-003 — un perfil activo declara al menos un área",
      `SELECT count(*) n FROM profiles p WHERE p.profile_status = 'active'
         AND NOT EXISTS (SELECT 1 FROM profile_service_areas a WHERE a.profile_id = p.id)`,
    ],
    [
      "BR-003 — un perfil activo tiene al menos una especialidad",
      `SELECT count(*) n FROM profiles p WHERE p.profile_status = 'active'
         AND NOT EXISTS (SELECT 1 FROM profile_specialties s WHERE s.profile_id = p.id AND s.is_active = 1)`,
    ],
    [
      "BR-003 — un perfil activo tiene al menos una modalidad",
      `SELECT count(*) n FROM profiles p WHERE p.profile_status = 'active'
         AND NOT EXISTS (SELECT 1 FROM profile_service_modes m WHERE m.profile_id = p.id)`,
    ],
    [
      "BR-003 — quien atiende en el negocio tiene local activo",
      `SELECT count(*) n FROM profiles p
         JOIN profile_service_modes m ON m.profile_id = p.id AND m.service_mode_id = 'at_business'
        WHERE p.profile_status = 'active'
          AND NOT EXISTS (SELECT 1 FROM profile_locations l WHERE l.profile_id = p.id AND l.is_active = 1)`,
    ],
    [
      "BR-010 — todo servicio cuelga de una especialidad del perfil",
      `SELECT count(*) n FROM services s
         LEFT JOIN profile_specialties ps
           ON ps.profile_id = s.profile_id AND ps.specialty_id = s.specialty_id
        WHERE ps.profile_id IS NULL`,
    ],
    [
      "BR-015 — una sola ubicación principal activa por perfil",
      `SELECT count(*) n FROM (
         SELECT profile_id FROM profile_locations
          WHERE is_primary = 1 AND is_active = 1
          GROUP BY profile_id HAVING count(*) > 1)`,
    ],
    [
      "BR-015 — el país no es una ubicación física",
      `SELECT count(*) n FROM profile_locations pl
         JOIN locations l ON l.id = pl.location_id WHERE l.type = 'country'`,
    ],
    [
      "TR-018 — Uruguay no se combina con otras áreas",
      `SELECT count(*) n FROM (
         SELECT profile_id FROM profile_service_areas
          GROUP BY profile_id
         HAVING sum(location_id = 'uruguay') > 0 AND count(*) > 1)`,
    ],
    [
      "TR-018 — un departamento no convive con sus localidades",
      `SELECT count(*) n FROM profile_service_areas a
         JOIN locations l ON l.id = a.location_id AND l.type = 'locality'
         JOIN profile_service_areas d
           ON d.profile_id = a.profile_id AND d.location_id = l.parent_id`,
    ],
    [
      "BR-024 — hasta 10 entradas de horario por perfil",
      `SELECT count(*) n FROM (
         SELECT profile_id FROM profile_schedule_entries
          GROUP BY profile_id HAVING count(*) > 10)`,
    ],
    [
      "BR-024 — cada entrada mide entre 3 y 120 caracteres",
      `SELECT count(*) n FROM profile_schedule_entries
        WHERE length(text) < 3 OR length(text) > 120`,
    ],
    [
      "BR-019 — Cobre no muestra insignia",
      `SELECT count(*) n FROM profiles
        WHERE plan_id = 'cobre' AND verification_status = 'verified'`,
    ],
    [
      "BR-006 — rubros activos dentro del tope del plan",
      `SELECT count(*) n FROM (
         SELECT p.id FROM profiles p
           JOIN profile_specialties ps ON ps.profile_id = p.id AND ps.is_active = 1
           JOIN specialties sp ON sp.id = ps.specialty_id
           JOIN plans pl ON pl.id = p.plan_id
          GROUP BY p.id
         HAVING pl.max_service_sectors IS NOT NULL
            AND count(DISTINCT sp.service_sector_id) > pl.max_service_sectors)`,
    ],
    [
      "BR-006 — especialidades activas dentro del tope del plan",
      `SELECT count(*) n FROM (
         SELECT p.id FROM profiles p
           JOIN profile_specialties ps ON ps.profile_id = p.id AND ps.is_active = 1
           JOIN plans pl ON pl.id = p.plan_id
          GROUP BY p.id
         HAVING pl.max_specialties IS NOT NULL AND count(*) > pl.max_specialties)`,
    ],
    [
      "BR-006 — servicios activos dentro del tope del plan",
      `SELECT count(*) n FROM (
         SELECT p.id FROM profiles p
           JOIN services s ON s.profile_id = p.id AND s.is_active = 1
           JOIN plans pl ON pl.id = p.plan_id
          GROUP BY p.id
         HAVING pl.max_services IS NOT NULL AND count(*) > pl.max_services)`,
    ],
    [
      "BR-006 — cartas de servicio activas dentro del tope del plan",
      `SELECT count(*) n FROM (
         SELECT p.id FROM profiles p
           JOIN service_cards sc ON sc.profile_id = p.id AND sc.is_active = 1
           JOIN plans pl ON pl.id = p.plan_id
          GROUP BY p.id
         HAVING count(*) > pl.max_service_cards)`,
    ],
    [
      "BR-034 — los perfiles mock con cartas tienen entre 2 y 5",
      `SELECT count(*) n FROM (
         SELECT profile_id FROM service_cards
          GROUP BY profile_id HAVING count(*) < 2 OR count(*) > 5)`,
    ],
    [
      "BR-034: toda carta se vincula a un servicio del mismo perfil y especialidad",
      `SELECT count(*) n FROM service_cards sc
         LEFT JOIN services s ON s.id = sc.service_id
        WHERE s.id IS NULL OR s.profile_id <> sc.profile_id
           OR s.specialty_id <> sc.specialty_id`,
    ],
    [
      "BR-034: la carta mock representa exactamente el servicio vinculado",
      `SELECT count(*) n FROM service_cards sc
         JOIN services s ON s.id = sc.service_id
        WHERE lower(sc.title) <> lower(s.name)`,
    ],
    [
      "BR-034: toda especialidad tiene una carta pública representativa",
      `SELECT count(*) n FROM specialties sp
        WHERE NOT EXISTS (
          SELECT 1 FROM service_cards sc
          JOIN profiles p ON p.id = sc.profile_id
          JOIN services s ON s.id = sc.service_id
          WHERE s.specialty_id = sp.id AND p.profile_status = 'active'
            AND sc.is_active = 1 AND sc.is_published = 1
        )`,
    ],
    [
      "BR-034: la modalidad de cada carta está declarada por el perfil",
      `SELECT count(*) n FROM service_cards sc
        WHERE NOT EXISTS (
          SELECT 1 FROM profile_service_modes psm
          WHERE psm.profile_id = sc.profile_id
            AND psm.service_mode_id = sc.service_mode
        )`,
    ],
    [
      "BR-034: importes mock plausibles y expresados en centésimos",
      `SELECT count(*) n FROM service_cards
        WHERE (price_min_cents IS NOT NULL AND
               (price_min_cents < 50000 OR price_min_cents > 30000000
                OR price_min_cents % 5000 <> 0))
           OR (price_max_cents IS NOT NULL AND
               (price_max_cents < price_min_cents OR price_max_cents > 50000000
                OR price_max_cents % 5000 <> 0))`,
    ],
    [
      "BR-006 — ubicaciones activas dentro del tope del plan",
      `SELECT count(*) n FROM (
         SELECT p.id FROM profiles p
           JOIN profile_locations l ON l.profile_id = p.id AND l.is_active = 1
           JOIN plans pl ON pl.id = p.plan_id
          GROUP BY p.id
         HAVING pl.max_locations IS NOT NULL AND count(*) > pl.max_locations)`,
    ],
    [
      "TR-027 — los agregados coinciden con las opiniones publicadas",
      `SELECT count(*) n FROM profiles p
        WHERE p.review_count <> (SELECT count(*) FROM reviews r
                                  WHERE r.profile_id = p.id AND r.status = 'published')
           OR p.rating_sum <> (SELECT coalesce(sum(rating), 0) FROM reviews r
                                WHERE r.profile_id = p.id AND r.status = 'published')`,
    ],
    [
      "TR-027 — review_count ≤ rating_sum ≤ review_count × 5",
      `SELECT count(*) n FROM profiles
        WHERE rating_sum < review_count OR rating_sum > review_count * 5`,
    ],
    [
      "BR-005 — no hay dos perfiles con el mismo slug",
      `SELECT count(*) n FROM (
         SELECT slug FROM profiles GROUP BY lower(slug) HAVING count(*) > 1)`,
    ],
    [
      "BR-001 — una cuenta administra como máximo un perfil",
      `SELECT count(*) n FROM (
         SELECT user_id FROM profiles GROUP BY user_id HAVING count(*) > 1)`,
    ],
  ];

  for (const [label, sql] of rules) {
    const n = violations(sql);
    check(label, n === 0, n > 0 ? `${n} violaciones` : "");
  }

  const counts = db
    .prepare(
      `SELECT (SELECT count(*) FROM locations) AS locations,
              (SELECT count(*) FROM specialties) AS specialties,
              (SELECT count(*) FROM profiles) AS profiles,
              (SELECT count(*) FROM services) AS services,
              (SELECT count(*) FROM service_cards) AS serviceCards,
              (SELECT count(*) FROM reviews) AS reviews`,
    )
    .get() as Record<string, number>;

  console.log(
    `\n  ${counts.locations} ubicaciones · ${counts.specialties} especialidades · ` +
      `${counts.profiles} perfiles · ${counts.services} servicios · ` +
      `${counts.serviceCards} cartas · ${counts.reviews} opiniones`,
  );
}

db.close();

console.log(
  failures === 0
    ? "\nTodo en orden.\n"
    : `\n${failures} verificación(es) fallaron.\n`,
);

process.exit(failures === 0 ? 0 : 1);
