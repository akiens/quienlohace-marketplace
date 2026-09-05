import type { ServiceSector, ServiceSuggestion, Specialty } from "@/types";

import data from "./taxonomy.json";

/**
 * Taxonomía administrada: rubro → especialidad → servicio (BR-010).
 *
 * La genera `npm run generate:services` desde
 * `docs/data/rubros_especialidades_servicios.md`, que es la fuente de la
 * verdad (TR-021). El proveedor selecciona rubros y especialidades, no los
 * crea (BR-011).
 *
 * Los servicios de este archivo son sugerencias para el autocompletado: lo que
 * se guarda en el perfil es el texto confirmado, no una referencia a esta
 * lista, que puede cambiar sin arrastrar los perfiles con ella (TR-022).
 */

export const SERVICE_SECTORS: ServiceSector[] = data.sectors;
export const SPECIALTIES: Specialty[] = data.specialties;
export const SERVICE_SUGGESTIONS: ServiceSuggestion[] = data.services;

const SECTOR_BY_ID = new Map(SERVICE_SECTORS.map((s) => [s.id, s]));
const SPECIALTY_BY_ID = new Map(SPECIALTIES.map((s) => [s.id, s]));

const SPECIALTIES_BY_SECTOR = new Map<string, Specialty[]>();
for (const specialty of SPECIALTIES) {
  const list = SPECIALTIES_BY_SECTOR.get(specialty.serviceSectorId);
  if (list) list.push(specialty);
  else SPECIALTIES_BY_SECTOR.set(specialty.serviceSectorId, [specialty]);
}

const SUGGESTIONS_BY_SPECIALTY = new Map<string, ServiceSuggestion[]>();
for (const suggestion of SERVICE_SUGGESTIONS) {
  const list = SUGGESTIONS_BY_SPECIALTY.get(suggestion.specialtyId);
  if (list) list.push(suggestion);
  else SUGGESTIONS_BY_SPECIALTY.set(suggestion.specialtyId, [suggestion]);
}

export function getServiceSector(id: string): ServiceSector | undefined {
  return SECTOR_BY_ID.get(id);
}

export function getSpecialty(id: string): Specialty | undefined {
  return SPECIALTY_BY_ID.get(id);
}

export function specialtyExists(id: string): boolean {
  return SPECIALTY_BY_ID.has(id);
}

export function getServiceSectorBySlug(slug: string): ServiceSector | undefined {
  return SERVICE_SECTORS.find((sector) => sector.slug === slug);
}

export function listSpecialties(serviceSectorId: string): Specialty[] {
  return SPECIALTIES_BY_SECTOR.get(serviceSectorId) ?? [];
}

/** El rubro al que pertenece una especialidad. */
export function sectorOfSpecialty(
  specialtyId: string,
): ServiceSector | undefined {
  const specialty = SPECIALTY_BY_ID.get(specialtyId);
  return specialty ? SECTOR_BY_ID.get(specialty.serviceSectorId) : undefined;
}

/**
 * Los rubros de un perfil (BR-010): salen de sus especialidades, no de una
 * selección aparte. Por eso no existe `profile_service_sectors`.
 */
export function sectorIdsOf(specialtyIds: string[]): string[] {
  const ids = new Set<string>();
  for (const id of specialtyIds) {
    const specialty = SPECIALTY_BY_ID.get(id);
    if (specialty) ids.add(specialty.serviceSectorId);
  }
  return [...ids];
}

/** BR-020: la especialidad exige habilitación aprobada y vigente. */
export function requiresCredential(specialtyId: string): boolean {
  return SPECIALTY_BY_ID.get(specialtyId)?.requiresProfessionalCredential ?? false;
}

/** Sugerencias de servicios de una especialidad, para el autocompletado. */
export function suggestionsFor(specialtyId: string): ServiceSuggestion[] {
  return SUGGESTIONS_BY_SPECIALTY.get(specialtyId) ?? [];
}
