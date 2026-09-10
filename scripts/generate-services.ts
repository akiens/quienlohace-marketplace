/**
 * Genera `src/data/taxonomy.json` desde
 * `docs/data/rubros_especialidades_servicios.md`.
 *
 * El documento es la fuente de la verdad de rubros, especialidades, servicios
 * y aliases (TR-021). El sitio lee el JSON, no el markdown.
 *
 * No hay tabla de correspondencias: cada bloque declara su propio id en una
 * línea suelta entre backticks, y el generador lo lee de ahí. Antes existía un
 * `MAPPING` que traducía los nombres del catálogo a los rubros del sitio;
 * ahora el documento y el sitio comparten los mismos identificadores, así que
 * mantener esa tabla en paralelo sería una segunda fuente de verdad.
 *
 * Formato leído:
 *   # <n>. <Rubro>
 *   `<id-rubro>` · corto: *<nombre corto>* · icono: `<icono>`
 *   ## <n>.<m>. <Especialidad>
 *   `<id-especialidad>` · alias: <oficio>, <oficio>
 *   - <Nombre canónico> — alias: <término>, <término>
 *
 * Falla ante ids duplicados, especialidades inexistentes, nombres vacíos o
 * duplicados normalizados (TR-021).
 *
 * Se corre a mano (`npm run generate:services`) y el resultado se commitea.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { slugify } from "../src/lib/slug";

type ServiceSectorEntry = {
  id: string;
  name: string;
  slug: string;
  short: string;
  icon: string;
  sortOrder: number;
};

type SpecialtyEntry = {
  id: string;
  serviceSectorId: string;
  name: string;
  slug: string;
  aliases: string[];
  /** BR-020: sus servicios exigen una habilitación aprobada y vigente. */
  requiresProfessionalCredential: boolean;
  sortOrder: number;
};

type ServiceEntry = {
  id: string;
  serviceSectorId: string;
  specialtyId: string;
  name: string;
  aliases: string[];
};

/**
 * Especialidades reguladas (BR-020).
 *
 * El documento las marca en prosa, dentro de un blockquote de "Clasificación",
 * y en dos formas distintas: Salud declara regulado el rubro entero, mientras
 * que Servicios profesionales nombra tres especialidades sueltas. Leer esa
 * prosa sería adivinar; se listan acá los ids, que son estables y verificables
 * contra el propio documento.
 *
 * Un rubro entero se escribe como su id: cubre todas sus especialidades.
 */
const REGULATED = new Set([
  // "rubro regulado": alcanza a las 9 especialidades de Salud.
  "salud",
  // Contabilidad, Legal —incluida escribanía— y Seguros.
  "servicios-profesionales-contabilidad",
  "servicios-profesionales-legal",
  "servicios-profesionales-seguros",
]);

function isRegulated(sectorId: string, specialtyId: string): boolean {
  return REGULATED.has(sectorId) || REGULATED.has(specialtyId);
}

/** Una línea que sólo contiene un identificador entre backticks. */
function declaredId(line: string): string | null {
  const match = /^`([a-z0-9-]+)`/.exec(line.trim());
  return match ? (match[1] ?? null) : null;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(
    resolve(here, "../docs/data/rubros_especialidades_servicios.md"),
    "utf8",
  );

  const sectors: ServiceSectorEntry[] = [];
  const specialties: SpecialtyEntry[] = [];
  const services: ServiceEntry[] = [];
  const problems: string[] = [];

  const sectorIds = new Set<string>();
  const specialtyIds = new Set<string>();
  const specialtyAliasOwners = new Map<string, string>();
  const serviceIds = new Set<string>();

  let sector: ServiceSectorEntry | null = null;
  let specialty: SpecialtyEntry | null = null;
  /** Nombres normalizados ya vistos en la especialidad vigente. */
  let serviceNames = new Set<string>();
  /** Nombre del encabezado a la espera de su línea de id. */
  let pendingSector: { name: string } | null = null;
  let pendingSpecialty: { name: string } | null = null;

  const lines = doc.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const at = `línea ${index + 1}`;

    /*
     * "# 1. Hogar, Construcción y Mantenimiento" abre un rubro. Los `#` sin
     * número (índice, anexos) cierran el rubro vigente: sus tablas y viñetas
     * no son servicios.
     */
    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      const numbered = /^\d+\.\s+(.+)$/.exec((heading[1] ?? "").trim());
      sector = null;
      specialty = null;
      pendingSpecialty = null;
      pendingSector = numbered ? { name: (numbered[1] ?? "").trim() } : null;
      continue;
    }

    // "## 1.1. Plomería y sanitaria" abre una especialidad.
    const subheading = /^##\s+(.+)$/.exec(line);
    if (subheading) {
      const numbered = /^\d+\.\d+\.\s+(.+)$/.exec((subheading[1] ?? "").trim());
      specialty = null;
      pendingSpecialty =
        numbered && sector ? { name: (numbered[1] ?? "").trim() } : null;
      continue;
    }

    /*
     * La línea de id sigue a su encabezado. La del rubro trae además el nombre
     * corto y el icono; la de la especialidad es sólo el id.
     */
    const id = declaredId(line);
    if (id) {
      if (pendingSector) {
        const short = /corto:\s*\*([^*]+)\*/.exec(line)?.[1]?.trim() ?? "";
        const icon = /icono:\s*`([^`]+)`/.exec(line)?.[1]?.trim() ?? "";

        if (sectorIds.has(id)) {
          problems.push(`${at}: rubro duplicado ${id}`);
          pendingSector = null;
          continue;
        }

        /*
         * TR-020 deriva el id del rubro del nombre corto. Comprobarlo evita que
         * el documento declare un id que no se corresponde con su nombre y que
         * después nadie pueda reproducir.
         */
        const expected = slugify(short);
        if (short && expected !== id) {
          problems.push(`${at}: el rubro ${id} no deriva de "${short}"`);
        }

        sectorIds.add(id);
        sector = {
          id,
          name: pendingSector.name,
          slug: id,
          short,
          icon,
          sortOrder: sectors.length,
        };
        sectors.push(sector);
        pendingSector = null;
        continue;
      }

      if (pendingSpecialty && sector) {
        if (specialtyIds.has(id)) {
          problems.push(`${at}: especialidad duplicada ${id}`);
          pendingSpecialty = null;
          continue;
        }

        // TR-020: `<id-rubro>-<slugify(nombre)>`.
        const slug = slugify(pendingSpecialty.name);
        const expected = `${sector.id}-${slug}`;
        if (expected !== id) {
          problems.push(
            `${at}: la especialidad ${id} no deriva de "${pendingSpecialty.name}" en ${sector.id}`,
          );
        }

        const aliases = (/alias:\s*(.+)$/.exec(line)?.[1] ?? "")
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean);
        const aliasesHere = new Set<string>();
        for (const alias of aliases) {
          const normalizedAlias = slugify(alias);
          if (!normalizedAlias) {
            problems.push(`${at}: alias vacío o inválido en ${id}`);
            continue;
          }
          if (aliasesHere.has(normalizedAlias)) {
            problems.push(`${at}: alias duplicado "${alias}" en ${id}`);
            continue;
          }
          aliasesHere.add(normalizedAlias);
          const owner = specialtyAliasOwners.get(normalizedAlias);
          if (owner && owner !== id) {
            problems.push(`${at}: alias "${alias}" compartido por ${owner} y ${id}`);
          } else {
            specialtyAliasOwners.set(normalizedAlias, id);
          }
        }

        specialtyIds.add(id);
        specialty = {
          id,
          serviceSectorId: sector.id,
          name: pendingSpecialty.name,
          slug,
          aliases,
          requiresProfessionalCredential: isRegulated(sector.id, id),
          sortOrder: specialties.filter((s) => s.serviceSectorId === sector!.id)
            .length,
        };
        specialties.push(specialty);
        serviceNames = new Set();
        pendingSpecialty = null;
        continue;
      }

      continue;
    }

    // "- Puesta a tierra — alias: descarga a tierra, jabalina"
    const bullet = /^-\s+(.+)$/.exec(line);
    if (!bullet) continue;

    // Las viñetas fuera de una especialidad son prosa del documento.
    if (!specialty || !sector) continue;

    const [rawName, rawAliases] = (bullet[1] ?? "").split(/\s+—\s+alias:\s*/);
    const name = (rawName ?? "").trim();
    if (!name) {
      problems.push(`${at}: servicio sin nombre en ${specialty.id}`);
      continue;
    }

    /*
     * BR-011: dentro de una especialidad no se repite un servicio, y la
     * comparación ignora mayúsculas y acentos. Se compara por slug, que es la
     * misma normalización con la que después se arma el id.
     */
    const normalized = slugify(name);
    if (!normalized) {
      problems.push(`${at}: "${name}" no produce un id válido`);
      continue;
    }
    if (serviceNames.has(normalized)) {
      problems.push(`${at}: servicio duplicado "${name}" en ${specialty.id}`);
      continue;
    }
    serviceNames.add(normalized);

    // TR-020: `<id-especialidad>-<slugify(nombre-canónico)>`.
    const serviceId = `${specialty.id}-${normalized}`;
    if (serviceIds.has(serviceId)) {
      problems.push(`${at}: id de servicio duplicado ${serviceId}`);
      continue;
    }
    serviceIds.add(serviceId);

    const aliases = (rawAliases ?? "")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);

    services.push({
      id: serviceId,
      serviceSectorId: sector.id,
      specialtyId: specialty.id,
      name,
      aliases,
    });
  }

  if (problems.length > 0) {
    console.error("El catálogo de servicios tiene problemas:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  writeFileSync(
    resolve(here, "../src/data/taxonomy.json"),
    `${JSON.stringify({ sectors, specialties, services }, null, 2)}\n`,
    "utf8",
  );

  const regulated = specialties.filter(
    (s) => s.requiresProfessionalCredential,
  ).length;

  console.log(
    `${sectors.length} rubros, ${specialties.length} especialidades ` +
      `(${regulated} reguladas) y ${services.length} servicios.`,
  );
}

main();
