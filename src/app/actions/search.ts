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
export async function runMarketplaceSearch(query: string) {
  const params = new URLSearchParams(query.slice(0, 8_000));
  const filters = filtersFromParams(params);
  const page = searchPageFromParams(params);
  const search = await searchMarketplace(filters, page);
  return { filters, search };
}
