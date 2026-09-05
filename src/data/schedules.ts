import suggestions from "./schedules.json";

import { normalize } from "./services";

/**
 * Sugerencias de horarios (BR-024).
 *
 * Las genera `npm run generate:schedules` desde
 * `docs/data/sugerencias_horarios.md`, que es la fuente de la verdad. Es un
 * `string[]` a propósito (TR-024): la sugerencia no es una entidad con id, es
 * un texto que se ofrece, se puede editar y se guarda tal como quedó
 * confirmado.
 */
export const SCHEDULE_SUGGESTIONS: string[] = suggestions;

/** BR-024: hasta diez líneas, de 3 a 120 caracteres cada una. */
export const MAX_SCHEDULE_ENTRIES = 10;
export const MIN_SCHEDULE_LENGTH = 3;
export const MAX_SCHEDULE_LENGTH = 120;

const INDEXED = SCHEDULE_SUGGESTIONS.map((text) => ({
  text,
  search: normalize(text),
}));

/**
 * Busca sugerencias de horario. TR-024 pide priorizar la coincidencia exacta,
 * después la que empieza con lo tipeado y por último la parcial.
 *
 * Sin texto devuelve el principio de la lista: son los horarios semanales más
 * habituales, que es lo que sirve como punto de partida.
 */
export function searchSchedules(query: string, limit = 8): string[] {
  const normalized = normalize(query);
  if (!normalized) return SCHEDULE_SUGGESTIONS.slice(0, limit);

  const scored: Array<{ text: string; points: number }> = [];
  for (const entry of INDEXED) {
    let points: number | null = null;
    if (entry.search === normalized) points = 100;
    else if (entry.search.startsWith(normalized)) points = 70;
    else if (entry.search.includes(normalized)) points = 40;

    if (points !== null) scored.push({ text: entry.text, points });
  }

  scored.sort(
    (a, b) => b.points - a.points || a.text.localeCompare(b.text, "es"),
  );

  return scored.slice(0, limit).map((entry) => entry.text);
}
