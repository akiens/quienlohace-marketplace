"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { ProviderGrid } from "@/components/provider-grid";
import { SearchPanel } from "@/components/search-panel";
import { getSubcategory } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import { filtersToQuery } from "@/lib/query";
import { countActiveFilters } from "@/lib/search";
import { Icon } from "@/components/ui";
import type { Provider, SearchFilters } from "@/types";

/**
 * Página de resultados. Los filtros viven en la URL: la búsqueda se puede
 * compartir y el botón "atrás" del navegador se comporta como se espera.
 * El filtrado ocurre en el servidor; acá sólo se manejan los controles.
 */
export function SearchExperience({
  filters,
  results,
  total,
}: {
  filters: SearchFilters;
  results: Provider[];
  /** Coincidencias totales, que pueden ser más que las cargadas. */
  total: number;
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCount = countActiveFilters(filters);

  function update(next: SearchFilters) {
    const query = filtersToQuery(next);
    // `scroll: false` evita saltar al tope cada vez que se toca un filtro.
    router.replace(query ? `/buscar?${query}` : "/buscar", { scroll: false });
  }

  return (
    <>
      <SearchPanel
        filters={filters}
        onChange={update}
        variant="compact"
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <div className="shell flex flex-col gap-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-[-.3px] text-ink sm:text-[25px]">
              {filters.query
                ? `Resultados para "${filters.query}"`
                : "Todos los profesionales"}
            </h1>
            <p className="text-[14.5px] text-ink-soft">
              {total}{" "}
              {total === 1
                ? "profesional encontrado"
                : "profesionales encontrados"}
            </p>
          </div>
        </div>

        {activeCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters.locationIds.map((id) => (
              <FilterChip
                key={id}
                label={locationLabelById(id)}
                onRemove={() =>
                  update({
                    ...filters,
                    locationIds: filters.locationIds.filter((x) => x !== id),
                  })
                }
              />
            ))}
            {filters.subcategoryIds.map((id) => (
              <FilterChip
                key={id}
                label={getSubcategory(id)?.name ?? id}
                onRemove={() =>
                  update({
                    ...filters,
                    subcategoryIds: filters.subcategoryIds.filter((x) => x !== id),
                  })
                }
              />
            ))}
            {filters.minRating !== null ? (
              <FilterChip
                label={`${filters.minRating}+ estrellas`}
                onRemove={() => update({ ...filters, minRating: null })}
              />
            ) : null}
            {filters.paymentMethods.map((method) => (
              <FilterChip
                key={method}
                label={method}
                onRemove={() =>
                  update({
                    ...filters,
                    paymentMethods: filters.paymentMethods.filter(
                      (x) => x !== method,
                    ),
                  })
                }
              />
            ))}

            <button
              type="button"
              onClick={() => update({ ...filters, ...emptyExceptQuery(filters) })}
              className="text-[13px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        <ProviderGrid providers={results} showAd />
      </div>

      <FiltersPanel
        open={filtersOpen}
        filters={filters}
        resultCount={total}
        onChange={update}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );
}

/** Limpia todo menos el texto buscado. */
function emptyExceptQuery(filters: SearchFilters): Partial<SearchFilters> {
  return {
    locationIds: [],
    subcategoryIds: [],
    minRating: null,
    paymentMethods: [],
    useMyLocation: false,
    query: filters.query,
  };
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pl-3 pr-2 text-[13px] font-semibold text-ink">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`}>
        <Icon name="close" className="text-[16px] text-ink-soft hover:text-ink" />
      </button>
    </span>
  );
}
