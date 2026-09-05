/**
 * Genera `src/data/schedules.json` desde `docs/data/sugerencias_horarios.md`.
 *
 * TR-024: sólo las viñetas de las secciones de sugerencias producen strings, se
 * toma el texto anterior a "— alias:", y el resultado es un `string[]` que
 * conserva el orden del documento. Los encabezados, los aliases y los grupos no
 * entran al JSON: son ayudas de edición, no datos.
 *
 * Falla ante duplicados normalizados.
 *
 * Se corre a mano (`npm run generate:schedules`) y el resultado se commitea.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** BR-024: cada entrada de horario mide entre 3 y 120 caracteres. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 120;

/**
 * Secciones que no son sugerencias: explican el formato o remiten a las
 * reglas, y sus viñetas no son horarios.
 */
const NON_SUGGESTION = /^##\s+\d+\.\s+(Formato editorial|Referencias normativas)/;

/**
 * Comparación para detectar duplicados: sin acentos, sin mayúsculas y con los
 * espacios colapsados. "Sábados: cerrado" y "sabados:  cerrado" son el mismo
 * texto para quien busca.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(
    resolve(here, "../docs/data/sugerencias_horarios.md"),
    "utf8",
  );

  const suggestions: string[] = [];
  const problems: string[] = [];
  const seen = new Map<string, number>();

  let inSuggestions = false;
  let inCodeBlock = false;

  const lines = doc.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const at = `línea ${index + 1}`;

    /*
     * El ejemplo de formato está dentro de un bloque de código y su viñeta es
     * un molde ("- Texto canónico — alias: …"), no una sugerencia.
     */
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (/^##\s+/.test(line)) {
      inSuggestions = !NON_SUGGESTION.test(line);
      continue;
    }

    if (!inSuggestions) continue;

    const bullet = /^-\s+(.+)$/.exec(line);
    if (!bullet) continue;

    // TR-024: sólo el texto anterior a "— alias:" entra al JSON.
    const text = ((bullet[1] ?? "").split(/\s+—\s+alias:/)[0] ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      problems.push(`${at}: sugerencia vacía`);
      continue;
    }

    if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
      problems.push(
        `${at}: "${text}" mide ${text.length} caracteres, fuera de ${MIN_LENGTH}–${MAX_LENGTH}`,
      );
      continue;
    }

    const key = normalize(text);
    const previous = seen.get(key);
    if (previous !== undefined) {
      problems.push(`${at}: "${text}" ya aparece en la línea ${previous}`);
      continue;
    }
    seen.set(key, index + 1);

    suggestions.push(text);
  }

  if (problems.length > 0) {
    console.error("Las sugerencias de horarios tienen problemas:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  writeFileSync(
    resolve(here, "../src/data/schedules.json"),
    `${JSON.stringify(suggestions, null, 2)}\n`,
    "utf8",
  );

  console.log(`${suggestions.length} sugerencias de horarios.`);
}

main();
