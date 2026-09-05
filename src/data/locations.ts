import type { Location, LocationType } from "@/types";

import data from "./locations.json";

/**
 * Catálogo geográfico de Uruguay: país, 19 departamentos y sus localidades
 * (BR-014).
 *
 * El árbol lo genera `npm run generate:locations` desde `docs/data/locations.md`,
 * que es la fuente de la verdad (TR-032). Acá no se escribe geografía a mano:
 * agregar una localidad es editar el documento y regenerar.
 *
 * En la base estos mismos datos viven en la tabla `locations`; el JSON es lo
 * que la puebla y lo que la UI usa para armar los selectores sin ir a la base.
 */

export const LOCATIONS: Location[] = data.locations as Location[];

/** Uruguay: la raíz del árbol y la cobertura nacional (BR-016). */
export const COUNTRY_ID = "uruguay";
export const COUNTRY_LABEL = "Uruguay";

const BY_ID = new Map(LOCATIONS.map((location) => [location.id, location]));

const CHILDREN = new Map<string, Location[]>();
for (const location of LOCATIONS) {
  if (location.parentId === null) continue;
  const siblings = CHILDREN.get(location.parentId);
  if (siblings) siblings.push(location);
  else CHILDREN.set(location.parentId, [location]);
}

export function getLocation(id: string): Location | undefined {
  return BY_ID.get(id);
}

export function locationExists(id: string): boolean {
  return BY_ID.has(id);
}

/** Los 19 departamentos, en el orden del documento. */
export function listDepartments(): Location[] {
  return CHILDREN.get(COUNTRY_ID) ?? [];
}

/** Localidades de un departamento. Vacío si el id no es un departamento. */
export function listLocalities(departmentId: string): Location[] {
  return CHILDREN.get(departmentId) ?? [];
}

/** El departamento de una localidad; el propio, si ya es un departamento. */
export function departmentOf(id: string): Location | undefined {
  const location = BY_ID.get(id);
  if (!location) return undefined;
  if (location.type === "department") return location;
  if (location.type === "locality") return BY_ID.get(location.parentId!);
  return undefined;
}

/**
 * Etiqueta legible del nivel elegido hacia arriba: "Trinidad, Flores",
 * "Canelones" o "Uruguay".
 */
export function locationLabel(location: Location): string {
  if (location.type === "locality") {
    const department = BY_ID.get(location.parentId!);
    return department ? `${location.name}, ${department.name}` : location.name;
  }
  return location.name;
}

export function locationLabelById(id: string): string {
  const location = BY_ID.get(id);
  return location ? locationLabel(location) : id;
}

export const TYPE_LABELS: Record<LocationType, string> = {
  country: "País",
  department: "Departamento",
  locality: "Localidad",
};

export function locationTypeLabel(id: string): string {
  const location = BY_ID.get(id);
  return location ? TYPE_LABELS[location.type] : TYPE_LABELS.country;
}

/**
 * BR-015: una ubicación física es un local, y el país no dice dónde está. Sólo
 * departamento o localidad sirven como dirección.
 */
export function isPhysicalLocation(id: string): boolean {
  const location = BY_ID.get(id);
  return location?.type === "department" || location?.type === "locality";
}

/**
 * Normaliza las áreas de servicio elegidas (TR-018).
 *
 * Elegir Uruguay es cobertura nacional y reemplaza todo lo demás; elegir un
 * departamento vuelve redundantes sus localidades y las quita. Así no quedan
 * dos filas diciendo lo mismo, que después haría contar de más y buscar mal.
 */
export function normalizeServiceAreas(ids: string[]): string[] {
  const valid = ids.filter((id) => BY_ID.has(id));

  if (valid.includes(COUNTRY_ID)) return [COUNTRY_ID];

  const departments = new Set(
    valid.filter((id) => BY_ID.get(id)?.type === "department"),
  );

  const kept: string[] = [];
  for (const id of valid) {
    if (kept.includes(id)) continue;
    const location = BY_ID.get(id)!;
    // La localidad sobra si su departamento ya cubre todo el territorio.
    if (location.type === "locality" && departments.has(location.parentId!)) {
      continue;
    }
    kept.push(id);
  }

  return kept;
}

/**
 * Ubicaciones que hacen aparecer a un perfil al buscar en `id` (TR-019).
 *
 * Buscar en una localidad encuentra a quien cubre el país entero, a quien
 * cubre su departamento y a quien cubre esa localidad exacta. Buscar en un
 * departamento encuentra además a quien sólo cubre alguna de sus localidades:
 * cubre parte del departamento, y esconderlo sería peor que mostrarlo.
 */
export function coveringLocationIds(id: string): string[] {
  const location = BY_ID.get(id);
  if (!location) return [COUNTRY_ID];

  if (location.type === "country") return [COUNTRY_ID];

  if (location.type === "locality") {
    return [COUNTRY_ID, location.parentId!, location.id];
  }

  return [
    COUNTRY_ID,
    location.id,
    ...listLocalities(location.id).map((child) => child.id),
  ];
}
