import { PROVIDERS } from "@/data/providers";
import { getCategoryOfSubcategory, getSubcategory } from "@/data/categories";
import { getLocation } from "@/data/locations";
import type { Provider, SearchFilters } from "@/types";
import { slugify } from "@/lib/slug";

/**
 * Búsqueda y filtrado del marketplace. Son funciones puras sobre un arreglo de
 * proveedores: hoy operan sobre datos locales y mañana sobre lo que devuelva la
 * API, sin que la UI tenga que cambiar.
 */

/** Texto sobre el que se busca: nombre, servicios, categoría y ubicación. */
function haystack(provider: Provider): string {
  const subcategory = getSubcategory(provider.subcategoryId);
  const category = getCategoryOfSubcategory(provider.subcategoryId);
  const location = getLocation(provider.locationId);

  return [
    provider.name,
    provider.description,
    ...provider.services,
    subcategory?.name ?? "",
    category?.name ?? "",
    location?.locality ?? "",
    location?.area ?? "",
    location?.department ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Normaliza para comparar sin acentos ni mayúsculas. */
function normalize(value: string): string {
  return slugify(value).replace(/-/g, " ");
}

function matchesQuery(provider: Provider, query: string): boolean {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const text = normalize(haystack(provider));
  return terms.every((term) => text.includes(term));
}

/**
 * Un proveedor coincide con una ubicación si está ubicado ahí o si declara
 * trabajar ahí. Seleccionar una localidad ("montevideo-montevideo") también
 * alcanza a sus barrios, que comparten el prefijo del ID.
 */
function matchesLocations(provider: Provider, locationIds: string[]): boolean {
  if (locationIds.length === 0) return true;

  const own = [provider.locationId, ...provider.serviceAreaIds];
  return locationIds.some((selected) =>
    own.some((id) => id === selected || id.startsWith(`${selected}-`)),
  );
}

function matchesSubcategories(
  provider: Provider,
  subcategoryIds: string[],
): boolean {
  return (
    subcategoryIds.length === 0 ||
    subcategoryIds.includes(provider.subcategoryId)
  );
}

function matchesRating(provider: Provider, minRating: number | null): boolean {
  if (minRating === null) return true;
  return provider.rating !== null && provider.rating >= minRating;
}

function matchesPayments(
  provider: Provider,
  methods: SearchFilters["paymentMethods"],
): boolean {
  return (
    methods.length === 0 ||
    methods.every((method) => provider.paymentMethods.includes(method))
  );
}

/**
 * Orden de resultados: primero los destacados (siempre rotulados como tales en
 * la UI), después por calificación y cantidad de opiniones. Los proveedores sin
 * opiniones quedan al final, pero siguen siendo visibles.
 */
function compareProviders(a: Provider, b: Provider): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;

  const ratingA = a.rating ?? -1;
  const ratingB = b.rating ?? -1;
  if (ratingA !== ratingB) return ratingB - ratingA;

  return b.reviewCount - a.reviewCount;
}

export function searchProviders(
  filters: SearchFilters,
  source: Provider[] = PROVIDERS,
): Provider[] {
  return source
    .filter(
      (provider) =>
        matchesQuery(provider, filters.query) &&
        matchesLocations(provider, filters.locationIds) &&
        matchesSubcategories(provider, filters.subcategoryIds) &&
        matchesRating(provider, filters.minRating) &&
        matchesPayments(provider, filters.paymentMethods),
    )
    .sort(compareProviders);
}

export function providersByCategory(categoryId: string): Provider[] {
  return PROVIDERS.filter((p) => p.categoryId === categoryId).sort(
    compareProviders,
  );
}

export function providersBySubcategory(subcategoryId: string): Provider[] {
  return PROVIDERS.filter((p) => p.subcategoryId === subcategoryId).sort(
    compareProviders,
  );
}

export function featuredProviders(): Provider[] {
  return PROVIDERS.filter((p) => p.featured).sort(compareProviders);
}

export function topRatedProviders(): Provider[] {
  return PROVIDERS.filter((p) => p.rating !== null).sort(compareProviders);
}

/** Cantidad de filtros activos, para el badge del botón "Filtros". */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.locationIds.length +
    filters.subcategoryIds.length +
    (filters.minRating !== null ? 1 : 0) +
    filters.paymentMethods.length
  );
}
