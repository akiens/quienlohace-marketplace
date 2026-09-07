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

/**
 * Cantidad de filtros activos, para el contador del botón "Filtros".
 *
 * Cuenta criterios elegidos, no secciones tocadas: tres zonas son tres. Lo
 * que está en "todos" no suma —es el estado de fábrica—, así que un panel
 * recién abierto muestra cero y el número dice cuánto se acotó la búsqueda.
 *
 * El texto escrito no entra: se ve en el campo del buscador, y contarlo haría
 * que el botón "Filtros" marcara uno por algo que no vive en ese panel.
 */
export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.resultKinds.length +
    filters.locationIds.length +
    filters.specialtyIds.length +
    (filters.minRating !== null ? 1 : 0) +
    filters.paymentMethods.length +
    filters.serviceModes.length +
    (filters.useMyLocation ? 1 : 0)
  );
}
