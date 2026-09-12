"use server";

import { searchMarketplace } from "@/application/search";
import { filtersFromParams, searchPageFromParams } from "@/lib/query";

/**
 * Ejecuta una búsqueda desde la portada estática de `/buscar`.
 *
 * Recibe la query string y vuelve a validarla en el servidor; no confía en el
 * objeto que mantiene el cliente ni permite una página fuera de los topes de
 * `searchPageFromParams`.
 */
export async function runMarketplaceSearch(
  query: string,
  continuity?: { searchId: string; resultSetId: string },
) {
  const params = new URLSearchParams(query.slice(0, 8_000));
  const filters = filtersFromParams(params);
  const page = searchPageFromParams(params);
  const cursor = params.get("cursor")?.slice(0, 160) ?? null;
  const searchIdPattern = /^search_[0-9a-f-]{36}$/;
  const resultSetIdPattern = /^results_[0-9a-f-]{36}$/;
  const validContinuity = continuity
    && searchIdPattern.test(continuity.searchId)
    && resultSetIdPattern.test(continuity.resultSetId)
    ? continuity
    : undefined;
  const search = await searchMarketplace(filters, page, validContinuity, cursor);
  return { filters, search };
}
