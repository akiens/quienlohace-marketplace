import "server-only";

import { PROVIDERS, getProviderBySlug as seedBySlug, getReviews as seedReviews } from "@/data/providers";
import { getCategoryOfSubcategory } from "@/data/categories";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { D1ReviewRepository } from "@/infrastructure/d1-repositories";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import {
  featuredProviders as seedFeatured,
  providersByCategory as seedByCategory,
  providersBySubcategory as seedBySubcategory,
  searchProviders as seedSearch,
} from "@/lib/search";
import type { Provider, Review, SearchFilters } from "@/types";

/**
 * Casos de uso de lectura del marketplace.
 *
 * Mientras la base no esté configurada, el sitio sigue funcionando con los
 * datos de ejemplo. Así el prototipo se puede mirar sin credenciales de
 * Cloudflare, y al conectar D1 las páginas no cambian.
 */

function databaseAvailable(): boolean {
  return hasCloudflareRuntime();
}

const providerRepo = new D1ProviderRepository();
const reviewRepo = new D1ReviewRepository();

export async function findProviderBySlug(slug: string): Promise<Provider | null> {
  if (!databaseAvailable()) return seedBySlug(slug) ?? null;
  return providerRepo.findBySlug(slug);
}

/**
 * El perfil tal como lo puede ver quien lo pide.
 *
 * Publicado lo ve cualquiera. Sin publicar —borrador, despublicado, en
 * revisión o suspendido— sólo su dueño, que es lo que hace posible la vista
 * previa antes de publicar. Para el resto, es como si no existiera: se
 * devuelve `null` y la página responde igual que ante un nombre inventado,
 * sin delatar que el perfil existe.
 */
export async function findVisibleProviderBySlug(
  slug: string,
  viewerUserId: string | null,
): Promise<{ provider: Provider; isPreview: boolean } | null> {
  const provider = await findProviderBySlug(slug);
  if (!provider) return null;

  if (isPublished(provider)) return { provider, isPreview: false };

  const isOwner = viewerUserId !== null && provider.userId === viewerUserId;
  return isOwner ? { provider, isPreview: true } : null;
}

/**
 * En los datos de ejemplo `status` no existe: son todos perfiles de muestra y
 * se tratan como publicados. De la base siempre viene con valor, así que ahí
 * la decisión la toma el estado real.
 */
function isPublished(provider: Provider): boolean {
  return (provider.status ?? "active") === "active";
}

/** Perfiles publicados con nombre parecido, para sugerir ante un 404. */
export async function findSimilarProviders(
  slug: string,
  limit = 8,
): Promise<Provider[]> {
  if (!databaseAvailable()) {
    const words = slug.split("-").filter((word) => word.length >= 3);
    return PROVIDERS.filter(
      (provider) =>
        provider.slug !== slug &&
        isPublished(provider) &&
        words.some((word) => provider.slug.includes(word)),
    ).slice(0, limit);
  }
  return providerRepo.findSimilarByName(slug, limit);
}

export async function searchProviders(
  filters: SearchFilters,
  limit = 48,
  offset = 0,
): Promise<Provider[]> {
  if (!databaseAvailable()) return seedSearch(filters).slice(offset, offset + limit);
  return providerRepo.search(filters, limit, offset);
}

export async function countProviders(filters: SearchFilters): Promise<number> {
  if (!databaseAvailable()) return seedSearch(filters).length;
  return providerRepo.countForSearch(filters);
}

export async function listByCategory(categoryId: string): Promise<Provider[]> {
  if (!databaseAvailable()) return seedByCategory(categoryId);
  return providerRepo.listByCategory(categoryId);
}

export async function listBySubcategory(subcategoryId: string): Promise<Provider[]> {
  if (!databaseAvailable()) return seedBySubcategory(subcategoryId);
  return providerRepo.listBySubcategory(subcategoryId);
}

export async function listFeatured(): Promise<Provider[]> {
  if (!databaseAvailable()) return seedFeatured();
  return providerRepo.listFeatured();
}

export async function listTopRated(): Promise<Provider[]> {
  const providers = databaseAvailable()
    ? await providerRepo.search(
        {
          query: "",
          locationIds: [],
          subcategoryIds: [],
          minRating: null,
          paymentMethods: [],
          useMyLocation: false,
        },
        12,
        0,
      )
    : PROVIDERS.filter((p) => p.rating !== null);

  return providers.filter((provider) => provider.rating !== null);
}

export async function listProviderSlugs(): Promise<string[]> {
  if (!databaseAvailable()) return PROVIDERS.map((provider) => provider.slug);
  return providerRepo.listPublishedSlugs();
}

export async function listReviews(providerId: string): Promise<Review[]> {
  if (!databaseAvailable()) return seedReviews(providerId);
  return reviewRepo.listForProvider(providerId);
}

/** Categoría a la que pertenece un proveedor, derivada de su subcategoría. */
export function categoryOf(provider: Provider) {
  return getCategoryOfSubcategory(provider.subcategoryId);
}
