/**
 * Verificación de integridad del dataset y de la lógica de búsqueda.
 * Se ejecuta con: npm run check:data
 */
import { CATEGORIES, getSubcategory } from "../src/data/categories";
import { PROVIDERS, REVIEWS } from "../src/data/providers";
import {
  LOCATIONS,
  getLocation,
  listAreas,
  listDepartments,
  listLocalities,
  locationLabelById,
} from "../src/data/locations";
import { searchProviders } from "../src/lib/search";
import { EMPTY_FILTERS } from "../src/types";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nUbicaciones (Master Data)");
check("19 departamentos", listDepartments().length === 19, `${listDepartments().length}`);
check("IDs únicos", new Set(LOCATIONS.map((l) => l.id)).size === LOCATIONS.length);
check(
  "Montevideo deriva sus barrios",
  listAreas("Montevideo", "Montevideo").length === 21,
);
check(
  "Flores no fuerza un tercer nivel",
  listAreas("Flores", "Trinidad").length === 0 &&
    listLocalities("Flores").length === 1,
);
check(
  "Etiqueta con barrio",
  locationLabelById("montevideo-montevideo-pocitos") === "Pocitos, Montevideo",
  locationLabelById("montevideo-montevideo-pocitos"),
);
check(
  "Etiqueta sin barrio",
  locationLabelById("flores-trinidad") === "Trinidad, Flores",
  locationLabelById("flores-trinidad"),
);

console.log("\nTaxonomía");
check("20 categorías", CATEGORIES.length === 20, `${CATEGORIES.length}`);
check(
  "IDs de subcategoría únicos",
  new Set(CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.id))).size ===
    CATEGORIES.flatMap((c) => c.subcategories).length,
);

console.log("\nProveedores");
check(
  "toda subcategoría referenciada existe",
  PROVIDERS.every((p) => getSubcategory(p.subcategoryId) !== undefined),
  PROVIDERS.filter((p) => !getSubcategory(p.subcategoryId))
    .map((p) => p.subcategoryId)
    .join(", "),
);
check(
  "categoryId coincide con la subcategoría",
  PROVIDERS.every((p) =>
    CATEGORIES.find((c) => c.id === p.categoryId)?.subcategories.some(
      (s) => s.id === p.subcategoryId,
    ),
  ),
  PROVIDERS.filter(
    (p) =>
      !CATEGORIES.find((c) => c.id === p.categoryId)?.subcategories.some(
        (s) => s.id === p.subcategoryId,
      ),
  )
    .map((p) => p.slug)
    .join(", "),
);
check(
  "toda ubicación referenciada existe",
  PROVIDERS.every((p) => getLocation(p.locationId) !== undefined),
  PROVIDERS.filter((p) => !getLocation(p.locationId))
    .map((p) => `${p.slug}:${p.locationId}`)
    .join(", "),
);
check(
  "toda zona de servicio existe",
  PROVIDERS.every((p) => p.serviceAreaIds.every((id) => getLocation(id))),
  PROVIDERS.flatMap((p) =>
    p.serviceAreaIds.filter((id) => !getLocation(id)).map((id) => `${p.slug}:${id}`),
  ).join(", "),
);
check("slugs únicos", new Set(PROVIDERS.map((p) => p.slug)).size === PROVIDERS.length);
check(
  "las opiniones apuntan a proveedores existentes",
  REVIEWS.every((r) => PROVIDERS.some((p) => p.id === r.providerId)),
);

console.log("\nBúsqueda");
check(
  "sin filtros devuelve todo",
  searchProviders(EMPTY_FILTERS).length === PROVIDERS.length,
);
check(
  "busca sin acentos",
  searchProviders({ ...EMPTY_FILTERS, query: "electricas" }).some(
    (p) => p.slug === "juan-electricidad",
  ),
);
check(
  "una localidad alcanza a sus barrios",
  searchProviders({
    ...EMPTY_FILTERS,
    locationIds: ["canelones-ciudad-de-la-costa"],
  }).some((p) => p.slug === "climasur"),
);
check(
  "filtra por calificación mínima",
  searchProviders({ ...EMPTY_FILTERS, minRating: 4.9 }).every(
    (p) => p.rating !== null && p.rating >= 4.9,
  ),
);
check(
  "los destacados van primero",
  searchProviders(EMPTY_FILTERS)[0]?.featured === true,
);
check(
  "combina texto y zona",
  searchProviders({
    ...EMPTY_FILTERS,
    query: "limpieza",
    locationIds: ["montevideo-montevideo-buceo"],
  }).some((p) => p.slug === "limpieza-total"),
);
check(
  "sin coincidencias devuelve vacío",
  searchProviders({ ...EMPTY_FILTERS, query: "zzzzzz" }).length === 0,
);

console.log(
  failures === 0
    ? "\nTodo en orden.\n"
    : `\n${failures} verificacion(es) fallaron.\n`,
);

process.exit(failures === 0 ? 0 : 1);
