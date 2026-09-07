"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { SearchPanel } from "@/components/search-panel";
import { searchHref } from "@/lib/query";
import { EMPTY_FILTERS, type SearchFilters } from "@/types";

/**
 * Dónde el buscador no se ofrece, ni siquiera plegado.
 *
 * La portada y los resultados quedan afuera porque ya traen el suyo, siempre
 * desplegado: la portada sobre el slider y `/buscar` con los filtros vigentes.
 * En el resto de estas páginas no hay nada que buscar.
 */
export function hidesGlobalSearch(pathname: string): boolean {
  // La portada lo lleva sobre el slider, en el medio de la pantalla.
  if (pathname === "/") return true;

  // Los resultados traen el suyo, que además conoce los filtros vigentes.
  if (pathname === "/buscar") return true;

  /*
   * El panel del proveedor y el alta son trabajo sobre el perfil propio, no
   * búsqueda: el buscador ahí sólo roba alto de pantalla.
   */
  if (pathname.startsWith("/dashboard")) return true;

  // Entrar y registrarse son un formulario y nada más.
  if (pathname === "/entrar" || pathname === "/registro") return true;

  return false;
}

/**
 * El buscador plegable que acompaña al encabezado en el resto del sitio.
 *
 * Va pegado debajo del header y sin texto alrededor: sólo el campo y los dos
 * botones. La bienvenida y el título viven en la portada, que es la única
 * pantalla donde el buscador es el contenido y no una herramienta a mano.
 *
 * Empieza plegado y lo abre el botón del encabezado: en una página que no es
 * de búsqueda, una barra siempre desplegada se come el alto de pantalla que
 * necesita lo que sí se vino a leer. Quien abre el buscador ya decidió buscar.
 *
 * Quién manda el estado es el encabezado, no este componente: el botón que
 * abre vive allá, y así los dos leen el mismo valor. Al navegar el header se
 * remonta —`key={pathname}`— y esto vuelve a empezar plegado.
 *
 * Como todo lo demás del buscador, no busca mientras se escribe: lo elegido se
 * junta en un borrador y sale al confirmar, navegando a `/buscar`.
 */
export function GlobalSearch({ open }: { open: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);

  if (hidesGlobalSearch(pathname)) return null;
  if (!open) return null;

  const search = (filters: SearchFilters) => {
    setDraft(filters);
    router.push(searchHref(filters));
  };

  return (
    // `id`: es lo que apunta el `aria-controls` del botón que lo abre.
    <div id="buscador-global">
      {/*
        `filters` es el borrador de acá y no `EMPTY_FILTERS`: lo que se elige
        en el panel lateral tiene que volver al buscador, que es donde se ve el
        contador de filtros puestos. Con una constante, ese camino de vuelta no
        existía —el buscador avisaba hacia arriba con `onDraftChange` pero
        nunca se enteraba de lo que pasaba afuera—, así que elegir filtros no
        movía el número.
      */}
      <SearchPanel
        filters={draft}
        onSubmit={search}
        onDraftChange={setDraft}
        variant="compact"
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {/* Sin `resultCount`: desde acá todavía no hay búsqueda hecha. */}
      <FiltersPanel
        open={filtersOpen}
        filters={draft}
        onChange={setDraft}
        onSubmit={() => search(draft)}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
