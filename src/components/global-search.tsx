"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { SearchPanel } from "@/components/search-panel";
import { searchHref } from "@/lib/query";
import { EMPTY_FILTERS, type SearchFilters } from "@/types";

/** Dónde el buscador global no va, y por qué. */
function hidesGlobalSearch(pathname: string): boolean {
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
 * El buscador que acompaña al encabezado en el resto del sitio.
 *
 * Va pegado debajo del header y sin texto alrededor: sólo el campo, la
 * ubicación, el rubro y los filtros. La bienvenida y el titulo viven en la
 * portada, que es la única pantalla donde el buscador es el contenido y no
 * una herramienta siempre a mano.
 *
 * Como todo lo demás del buscador, no busca mientras se escribe: lo elegido
 * se junta en un borrador y sale al confirmar, navegando a `/buscar`.
 */
export function GlobalSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);

  if (hidesGlobalSearch(pathname)) return null;

  const search = (filters: SearchFilters) => {
    setDraft(filters);
    router.push(searchHref(filters));
  };

  return (
    <>
      <SearchPanel
        filters={EMPTY_FILTERS}
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
    </>
  );
}
