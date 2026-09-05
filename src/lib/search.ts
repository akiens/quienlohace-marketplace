import type { SearchFilters } from "@/types";

/**
 * Ayudas de búsqueda para la interfaz.
 *
 * El filtrado de verdad lo hace la base (`D1ProfileRepository.search`): es
 * donde están los perfiles y donde se puede paginar. Antes había acá una copia
 * en memoria que filtraba sobre un arreglo de ejemplo, con su propia idea de
 * qué significa cada filtro; se quitó porque dos implementaciones de la misma
 * regla terminan discrepando y la que se ve no es la que manda.
 */

/** Cantidad de filtros activos, para el contador del botón "Filtros". */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.locationIds.length +
    filters.specialtyIds.length +
    (filters.minRating !== null ? 1 : 0) +
    filters.paymentMethods.length
  );
}
