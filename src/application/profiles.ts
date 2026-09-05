import "server-only";

import { sectorOfSpecialty } from "@/data/taxonomy";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ReviewRepository } from "@/infrastructure/d1-repositories";
import { EMPTY_FILTERS } from "@/types";
import type { Profile, Review, SearchFilters, ServiceSector } from "@/types";

/**
 * Casos de uso de lectura del marketplace.
 *
 * Antes había un juego de perfiles de ejemplo en el código, para poder mirar
 * el sitio sin credenciales de Cloudflare. Se quitó: mantenerlo obligaba a
 * escribir dos veces cada regla —una en SQL y otra en TypeScript— y las dos
 * versiones se contradecían apenas cambiaba algo. El seed de desarrollo
 * (`npm run seed:generate` + `npm run db:seed:local`) cumple la misma función
 * contra la base de verdad, que es lo que se quiere probar.
 */

const profileRepo = new D1ProfileRepository();
const reviewRepo = new D1ReviewRepository();

export async function findProfileBySlug(slug: string): Promise<Profile | null> {
  return profileRepo.findBySlug(slug);
}

/**
 * El perfil tal como lo puede ver quien lo pide.
 *
 * Publicado lo ve cualquiera. Sin publicar —borrador, despublicado o
 * suspendido— sólo su dueño, que es lo que hace posible la vista previa antes
 * de publicar. Para el resto es como si no existiera: se devuelve `null` y la
 * página responde igual que ante un nombre inventado, sin delatar que el
 * perfil existe (BR-002, TR-037).
 */
export async function findVisibleProfileBySlug(
  slug: string,
  viewerUserId: string | null,
): Promise<{ profile: Profile; isPreview: boolean } | null> {
  const profile = await findProfileBySlug(slug);
  if (!profile) return null;

  if (profile.profileStatus === "active") return { profile, isPreview: false };

  const isOwner = viewerUserId !== null && profile.userId === viewerUserId;
  return isOwner ? { profile, isPreview: true } : null;
}

/** Perfiles publicados con nombre parecido, para sugerir ante un 404. */
export async function findSimilarProfiles(
  slug: string,
  limit = 8,
): Promise<Profile[]> {
  return profileRepo.findSimilarByName(slug, limit);
}

export async function searchProfiles(
  filters: SearchFilters,
  limit = 48,
  offset = 0,
): Promise<Profile[]> {
  return profileRepo.search(filters, limit, offset);
}

export async function countProfiles(filters: SearchFilters): Promise<number> {
  return profileRepo.countForSearch(filters);
}

/** Perfiles de un rubro, resuelto a través de sus especialidades (BR-010). */
export async function listByServiceSector(
  serviceSectorId: string,
): Promise<Profile[]> {
  return profileRepo.listByServiceSector(serviceSectorId);
}

export async function listBySpecialty(specialtyId: string): Promise<Profile[]> {
  return profileRepo.listBySpecialty(specialtyId);
}

export async function listFeatured(): Promise<Profile[]> {
  return profileRepo.listFeatured();
}

export async function listTopRated(limit = 12): Promise<Profile[]> {
  const profiles = await profileRepo.search(EMPTY_FILTERS, limit, 0);
  // BR-026: sin opiniones no hay promedio, así que no compiten por este lugar.
  return profiles.filter((profile) => profile.rating !== null);
}

export async function listProfileSlugs(): Promise<string[]> {
  return profileRepo.listPublishedSlugs();
}

export async function listReviews(profileId: string): Promise<Review[]> {
  return reviewRepo.listForProfile(profileId);
}

/**
 * Los rubros de un perfil. No es un campo suyo: se derivan de sus
 * especialidades activas (BR-010), que es lo que evita que un perfil declare
 * un rubro que no trabaja.
 */
export function sectorsOf(profile: Profile): ServiceSector[] {
  const sectors = new Map<string, ServiceSector>();
  for (const specialtyId of profile.specialtyIds) {
    const sector = sectorOfSpecialty(specialtyId);
    if (sector) sectors.set(sector.id, sector);
  }
  return [...sectors.values()];
}

/** El rubro principal: el de la primera especialidad, que es la prioritaria. */
export function primarySectorOf(profile: Profile): ServiceSector | undefined {
  return sectorsOf(profile)[0];
}

/**
 * BR-017: "híbrida" no es una modalidad guardada, se deriva de haber elegido
 * más de una.
 */
export function isHybrid(profile: Profile): boolean {
  return profile.serviceModes.length > 1;
}
