/**
 * Genera `src/data/locations.json` desde `docs/data/locations.md`.
 *
 * El documento es la fuente de la verdad (TR-032): de acá sale el dataset que
 * puebla la tabla jerárquica `locations`. El sitio lee el JSON, no el markdown.
 *
 * Parsing (TR-032):
 *   * se crea la raíz `uruguay`;
 *   * cada encabezado `# <n>. <Departamento>` abre un `department`;
 *   * cada viñeta sin indentación es una `locality` del departamento vigente;
 *   * encabezados `##` y prosa se ignoran — son agrupaciones de lectura;
 *   * una viñeta indentada es error: no existe un cuarto nivel.
 *
 * Los paréntesis se conservan en `name` y se excluyen del slug: "Canelones
 * (Guadalupe)" se ve entero pero su id es `canelones-canelones`, que es como
 * se lo busca.
 *
 * Se corre a mano (`npm run generate:locations`) y el resultado se commitea.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { slugify } from "../src/lib/slug";

type LocationType = "country" | "department" | "locality";

type LocationEntry = {
  id: string;
  parentId: string | null;
  type: LocationType;
  name: string;
  slug: string;
};

/** TR-033: el catálogo tiene exactamente 19 departamentos. */
const EXPECTED_DEPARTMENTS = 19;

const COUNTRY_ID = "uruguay";
const COUNTRY_NAME = "Uruguay";

/**
 * El nombre sin la aclaración entre paréntesis.
 *
 * TR-032 pide que el paréntesis siga visible pero no entre al slug: quien
 * busca "Charqueada" no escribe "(La Charqueada)", y el id tiene que ser
 * estable aunque mañana se edite la aclaración.
 */
function slugSource(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(resolve(here, "../docs/data/locations.md"), "utf8");

  const locations: LocationEntry[] = [
    {
      id: COUNTRY_ID,
      parentId: null,
      type: "country",
      name: COUNTRY_NAME,
      slug: COUNTRY_ID,
    },
  ];

  const problems: string[] = [];
  const seenIds = new Set<string>([COUNTRY_ID]);
  /** Slugs ya usados dentro del departamento vigente (TR-033). */
  let localitySlugs = new Set<string>();
  let departmentId = "";
  let departments = 0;
  let localities = 0;

  const lines = doc.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const at = `línea ${index + 1}`;

    /*
     * "# 1. Montevideo" abre un departamento. El índice de departamentos y el
     * anexo también son `#`, pero no llevan número: quedan fuera por el patrón
     * y con ellos se cierra el departamento vigente, así que las viñetas del
     * anexo no se cuelgan del último departamento leído.
     */
    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      const department = /^\d+\.\s+(.+)$/.exec((heading[1] ?? "").trim());
      if (!department) {
        departmentId = "";
        continue;
      }

      const name = (department[1] ?? "").trim();
      const slug = slugify(slugSource(name));
      departmentId = slug;
      localitySlugs = new Set();
      departments += 1;

      if (seenIds.has(departmentId)) {
        problems.push(`${at}: departamento duplicado "${name}"`);
        continue;
      }
      seenIds.add(departmentId);

      locations.push({
        id: departmentId,
        parentId: COUNTRY_ID,
        type: "department",
        name,
        slug,
      });
      continue;
    }

    // Los `##` son agrupaciones de lectura: no generan ubicación.
    if (/^##\s+/.test(line)) continue;

    /*
     * Una viñeta indentada sería un cuarto nivel, que el modelo no admite
     * (TR-032). Se corta en vez de aplanarla en silencio: un barrio colgado de
     * un departamento es un dato inventado.
     */
    if (/^\s+[-*]\s+/.test(line)) {
      problems.push(`${at}: viñeta indentada, no existe un cuarto nivel`);
      continue;
    }

    const bullet = /^-\s+(.+)$/.exec(line);
    if (!bullet) continue;

    // Fuera de un departamento no hay a quién colgar la localidad.
    if (!departmentId) continue;

    const name = (bullet[1] ?? "").trim();
    if (!name) {
      problems.push(`${at}: localidad sin nombre`);
      continue;
    }

    const slug = slugify(slugSource(name));
    if (!slug) {
      problems.push(`${at}: "${name}" no produce un slug válido`);
      continue;
    }

    // TR-033: la localidad es única dentro de su departamento.
    if (localitySlugs.has(slug)) {
      problems.push(`${at}: "${name}" repetida en ${departmentId}`);
      continue;
    }
    localitySlugs.add(slug);

    const id = `${departmentId}-${slug}`;
    if (seenIds.has(id)) {
      problems.push(`${at}: id duplicado ${id}`);
      continue;
    }
    seenIds.add(id);

    locations.push({
      id,
      parentId: departmentId,
      type: "locality",
      name,
      slug,
    });
    localities += 1;
  }

  if (departments !== EXPECTED_DEPARTMENTS) {
    problems.push(
      `se esperaban ${EXPECTED_DEPARTMENTS} departamentos y se encontraron ${departments}`,
    );
  }

  if (problems.length > 0) {
    console.error("El catálogo geográfico tiene problemas:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  writeFileSync(
    resolve(here, "../src/data/locations.json"),
    `${JSON.stringify({ locations }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `${departments} departamentos y ${localities} localidades (${locations.length} filas).`,
  );
}

main();
