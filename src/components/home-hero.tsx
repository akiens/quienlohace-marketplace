"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { SearchPanel } from "@/components/search-panel";
import { searchHref } from "@/lib/query";
import { EMPTY_FILTERS, type SearchFilters } from "@/types";

/**
 * Buscador de la portada, con los mismos controles que el de resultados:
 * texto, ubicación, rubro y el panel de filtros avanzados.
 *
 * Nada de esto busca por su cuenta. Lo elegido se junta en un borrador y sale
 * recién al confirmar, que acá significa navegar a `/buscar` con todo puesto.
 *
 * El borrador vive en este componente y no sólo dentro del panel porque el
 * panel de filtros tiene que partir de lo que se venía escribiendo: si
 * partiera de los filtros vacíos, aplicar un filtro descartaría el texto ya
 * tipeado.
 */
export function HomeHero() {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);

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
        variant="hero"
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {/*
        Sin `resultCount`: todavía no hay búsqueda hecha, así que el pie del
        panel no puede prometer un número de resultados. Ahí el botón lanza la
        búsqueda en vez de sólo cerrar.
      */}
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
