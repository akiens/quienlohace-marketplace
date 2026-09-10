import type { SearchQueryPlan } from "@/types";

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Construye sólo SQL con nombres de columna internos; todo texto va por bind. */
export function textSearchClause(fields: string[], plan: SearchQueryPlan) {
  // D1/SQLite limita la complejidad de una expresión LIKE. Se conservan las
  // equivalencias más fuertes que el intérprete coloca primero.
  const phrases = plan.phrases.filter((phrase) => phrase.length <= 64).slice(0, 6);
  const terms = plan.coreTerms.slice(0, 3);
  const alternatives: string[] = [];
  const params: string[] = [];

  if (phrases.length) {
    alternatives.push(`(${phrases.flatMap(() => fields.map((field) => `${field} LIKE ? ESCAPE '\\'`)).join(" OR ")})`);
    for (const phrase of phrases) {
      params.push(...fields.map(() => `%${escapeLike(phrase)}%`));
    }
  }
  if (terms.length) {
    alternatives.push(`(${terms.map(() => `(${fields.map((field) => `${field} LIKE ? ESCAPE '\\'`).join(" OR ")})`).join(" AND ")})`);
    for (const term of terms) {
      params.push(...fields.map(() => `%${escapeLike(term)}%`));
    }
  }
  return { clause: alternatives.length ? `(${alternatives.join(" OR ")})` : "0 = 1", params };
}
