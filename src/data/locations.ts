import type { Location } from "@/types";
import { slugify } from "@/lib/slug";

/**
 * Fuente única de verdad de la geografía uruguaya.
 * Se escribe como árbol por comodidad de mantenimiento y se deriva a una
 * colección plana: departamentos, localidades y zonas salen todos de acá.
 * No existe CRUD para estos datos (ver RF-118 / RF-119).
 */
const GEO_SOURCE: Record<string, Record<string, string[]>> = {
  Montevideo: {
    Montevideo: [
      "Aguada", "Bella Vista", "Buceo", "Carrasco", "Centro", "Ciudad Vieja",
      "Cordón", "La Blanqueada", "Malvín", "Palermo", "Parque Batlle",
      "Parque Rodó", "Paso Molino", "Pocitos", "Prado", "Punta Carretas",
      "Punta Gorda", "Reducto", "Sayago", "Tres Cruces", "Unión",
    ],
  },
  Canelones: {
    "Ciudad de la Costa": [
      "Shangrilá", "San José de Carrasco", "Lagomar", "Solymar",
      "Lomas de Solymar", "El Pinar",
    ],
    "Las Piedras": [], Pando: [], Atlántida: [], "La Paz": [],
    Canelones: [], Toledo: [], Salinas: [],
  },
  Maldonado: {
    Maldonado: [],
    "Punta del Este": [
      "Península", "Aidy Grill", "Roosevelt", "Cantegril", "Beverly Hills",
    ],
    "San Carlos": [], Piriápolis: [], "La Barra": [],
  },
  Colonia: {
    "Colonia del Sacramento": [], Carmelo: [], "Nueva Helvecia": [], Rosario: [],
  },
  "San José": {
    "San José de Mayo": [],
    "Ciudad del Plata": ["Delta del Tigre", "Playa Pascual", "Safici"],
    Libertad: [],
  },
  Rocha: { Rocha: [], "La Paloma": [], Chuy: [], Castillos: [] },
  Salto: { Salto: [] },
  Paysandú: { Paysandú: [], Guichón: [] },
  Rivera: { Rivera: [], Tranqueras: [] },
  Soriano: { Mercedes: [], Dolores: [] },
  Flores: { Trinidad: [] },
  Florida: { Florida: [], "Sarandí Grande": [] },
  Durazno: { Durazno: [] },
  Lavalleja: { Minas: [] },
  Artigas: { Artigas: [], "Bella Unión": [] },
  "Cerro Largo": { Melo: [], "Río Branco": [] },
  "Río Negro": { "Fray Bentos": [], Young: [] },
  Tacuarembó: { Tacuarembó: [], "Paso de los Toros": [] },
  "Treinta y Tres": { "Treinta y Tres": [] },
};

function buildLocations(): Location[] {
  const out: Location[] = [];

  for (const [department, localities] of Object.entries(GEO_SOURCE)) {
    const departmentSlug = slugify(department);

    for (const [locality, areas] of Object.entries(localities)) {
      const localitySlug = slugify(locality);
      const base = `${departmentSlug}-${localitySlug}`;

      // La localidad siempre existe como ubicación seleccionable, tenga o no
      // barrios. Así "Flores → Trinidad" no necesita un tercer nivel artificial.
      out.push({ id: base, department, departmentSlug, locality, localitySlug });

      for (const area of areas) {
        const areaSlug = slugify(area);
        out.push({
          id: `${base}-${areaSlug}`,
          department, departmentSlug,
          locality, localitySlug,
          area, areaSlug,
        });
      }
    }
  }

  return out;
}

export const LOCATIONS: Location[] = buildLocations();

const BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

export function getLocation(id: string): Location | undefined {
  return BY_ID.get(id);
}

/** Etiqueta legible: "Pocitos, Montevideo" o "Trinidad, Flores". */
export function locationLabel(location: Location): string {
  return location.area
    ? `${location.area}, ${location.locality}`
    : `${location.locality}, ${location.department}`;
}

export function locationLabelById(id: string): string {
  const location = getLocation(id);
  return location ? locationLabel(location) : id;
}

/** Departamentos derivados del dataset maestro (RF-114). */
export function listDepartments(): string[] {
  return [...new Set(LOCATIONS.map((l) => l.department))];
}

/** Localidades de un departamento (RF-115). */
export function listLocalities(department: string): string[] {
  return [
    ...new Set(
      LOCATIONS.filter((l) => l.department === department).map((l) => l.locality),
    ),
  ];
}

/** Zonas de una localidad (RF-116). Vacío = no mostrar el tercer selector. */
export function listAreas(department: string, locality: string): Location[] {
  return LOCATIONS.filter(
    (l) => l.department === department && l.locality === locality && l.area,
  );
}

/** ID de la localidad sin barrio, para seleccionarla como zona completa. */
export function localityId(department: string, locality: string): string {
  return `${slugify(department)}-${slugify(locality)}`;
}
