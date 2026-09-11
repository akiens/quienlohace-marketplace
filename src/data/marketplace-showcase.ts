/**
 * Selecciones preparadas para las superficies que se sirven sin búsqueda.
 *
 * Los ids son los ids estables de `profiles` y `service_cards`, no sus slugs.
 * Dejar una lista vacía activa el fallback documentado junto a cada campo.
 * Los elementos inexistentes, despublicados o inactivos se omiten.
 *
 * Este archivo es deliberadamente datos y no una consulta: permite revisar y
 * desplegar una selección junto con el código, y cambiar de 1 a 10 tarjetas de
 * cada sección de Inicio sin tocar sus componentes. Después de editarlo hay
 * que ejecutar `npm run showcase:generate:remote` y guardar también el JSON
 * generado; el build falla si la selección y el snapshot no coinciden.
 */
export const MARKETPLACE_SHOWCASE = {
  home: {
    /** Vacío: los primeros cuatro perfiles publicados. */
    featuredProviderIds: [
      // "profile-id",
    ] as string[],
    /** Vacío: los primeros cuatro por calificación, sin repetir destacados. */
    topRatedProviderIds: [
      // "profile-id",
    ] as string[],
  },
  search: {
    /**
     * Hasta doce resultados mezclados. El orden final conserva la regla de
     * alternar dueños para que las cartas de uno solo no ocupen la grilla.
     * Vacío: se prepara una muestra diversa de doce perfiles y cartas.
     */
    items: [
      // { kind: "profile", id: "profile-id" },
      // { kind: "service", id: "service-card-id" },
    ] as Array<
      | { kind: "profile"; id: string }
      | { kind: "service"; id: string }
    >,
  },
} as const;

function assertShowcaseLimits(): void {
  if (MARKETPLACE_SHOWCASE.home.featuredProviderIds.length > 10) {
    throw new Error("Inicio admite hasta 10 profesionales destacados.");
  }
  if (MARKETPLACE_SHOWCASE.home.topRatedProviderIds.length > 10) {
    throw new Error("Inicio admite hasta 10 profesionales mejor calificados.");
  }
  if (MARKETPLACE_SHOWCASE.search.items.length > 12) {
    throw new Error("Buscar admite hasta 12 resultados preparados.");
  }
}

assertShowcaseLimits();
