"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { ProfileGrid } from "@/components/profile-grid";
import { ServiceCardGrid } from "@/components/service-card-grid";
import { SearchPanel } from "@/components/search-panel";
import { getSpecialty } from "@/data/taxonomy";
import { locationLabelById } from "@/data/locations";
import { filtersToQuery } from "@/lib/query";
import { countActiveFilters } from "@/lib/search";
import { EmptyState, Icon } from "@/components/ui";
import type { MarketplaceSearchResult } from "@/application/search";
import {
  PAYMENT_METHOD_LABELS,
  RESULT_KIND_LABELS,
  SERVICE_MODE_LABELS,
  type SearchFilters,
} from "@/types";

/**
 * Página de resultados. Los filtros viven en la URL: la búsqueda se puede
 * compartir y el botón "atrás" del navegador se comporta como se espera.
 * El filtrado ocurre en el servidor; acá sólo se manejan los controles.
 */
export function SearchExperience({
  filters,
  search,
}: {
  filters: SearchFilters;
  search: MarketplaceSearchResult;
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  /*
   * Lo que se está escribiendo en el buscador y todavía no se confirmó.
   *
   * Vive acá y no sólo dentro del panel porque el panel lateral de filtros
   * tiene que partir de esto: aplicar un filtro ahí mientras hay texto sin
   * buscar descartaba lo tipeado y devolvía la búsqueda anterior.
   */
  const [draft, setDraft] = useState<SearchFilters>(filters);

  const activeCount = countActiveFilters(filters);
  const total = search.profileTotal + search.serviceTotal;
  const servicesFirst = Boolean(filters.query.trim());

  function update(next: SearchFilters) {
    const query = filtersToQuery(next);
    // `scroll: false` evita saltar al tope cada vez que se toca un filtro.
    router.replace(query ? `/buscar?${query}` : "/buscar", { scroll: false });
  }

  return (
    <>
      {/*
        El panel avisa al buscar, no mientras se escribe: `onSubmit` y no
        `onChange`. Antes cada tecla y cada categoría elegida iban a la URL, y
        el servidor buscaba con frases a medio escribir.

        Los chips de abajo y el panel lateral sí siguen aplicando al instante:
        ahí no se está componiendo una búsqueda sino corrigiendo una hecha.
      */}
      <SearchPanel
        filters={filters}
        onSubmit={update}
        onDraftChange={setDraft}
        variant="compact"
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <div className="shell flex flex-col gap-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-[-.3px] text-ink sm:text-[25px]">
              {filters.query
                ? `Resultados para "${filters.query}"`
                : "Profesionales y servicios"}
            </h1>
            <p className="text-[14.5px] text-ink-soft">
              {total} {total === 1 ? "resultado encontrado" : "resultados encontrados"}
            </p>
          </div>
        </div>

        {activeCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters.resultKinds.map((kind) => (
              <FilterChip
                key={kind}
                label={RESULT_KIND_LABELS[kind]}
                onRemove={() => update({ ...draft, resultKinds: draft.resultKinds.filter((value) => value !== kind) })}
              />
            ))}
            {filters.locationIds.map((id) => (
              <FilterChip
                key={id}
                label={locationLabelById(id)}
                onRemove={() =>
                  update({
                    ...draft,
                    locationIds: draft.locationIds.filter((x) => x !== id),
                  })
                }
              />
            ))}
            {filters.specialtyIds.map((id) => (
              <FilterChip
                key={id}
                label={getSpecialty(id)?.name ?? id}
                onRemove={() =>
                  update({
                    ...draft,
                    specialtyIds: draft.specialtyIds.filter((x) => x !== id),
                  })
                }
              />
            ))}
            {filters.minRating !== null ? (
              <FilterChip
                label={`${filters.minRating}+ estrellas`}
                onRemove={() => update({ ...draft, minRating: null })}
              />
            ) : null}
            {filters.paymentMethods.map((method) => (
              <FilterChip
                key={method}
                label={PAYMENT_METHOD_LABELS[method]}
                onRemove={() =>
                  update({
                    ...draft,
                    paymentMethods: draft.paymentMethods.filter(
                      (x) => x !== method,
                    ),
                  })
                }
              />
            ))}
            {filters.serviceModes.map((mode) => (
              <FilterChip
                key={mode}
                label={SERVICE_MODE_LABELS[mode]}
                onRemove={() => update({ ...draft, serviceModes: draft.serviceModes.filter((value) => value !== mode) })}
              />
            ))}

            <button
              type="button"
              onClick={() => update({ ...draft, ...emptyExceptQuery(draft) })}
              className="text-[13px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {search.interpretation.inferredMode && filters.serviceModes.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-brand-100 px-4 py-3 text-[13.5px] text-ink">
            <span>
              Interpretamos una preferencia por <strong>{SERVICE_MODE_LABELS[search.interpretation.inferredMode].toLocaleLowerCase("es")}</strong>.
            </span>
            <Link
              href={`/buscar?${filtersToQuery({ ...filters, serviceModes: [search.interpretation.inferredMode] })}`}
              className="font-bold text-brand-800 underline underline-offset-2"
            >
              Aplicar este filtro
            </Link>
          </div>
        ) : null}

        {total === 0 ? (
          <NoResults filters={filters} search={search} />
        ) : servicesFirst ? (
          <>
            <ServiceResults search={search} />
            <ProfileResults search={search} />
          </>
        ) : (
          <>
            <ProfileResults search={search} />
            <ServiceResults search={search} />
          </>
        )}
      </div>

      {/*
        Parte del borrador y no de lo aplicado: si hay algo escrito sin buscar,
        aplicar un filtro acá lo tiene que conservar, no descartarlo.
      */}
      <FiltersPanel
        open={filtersOpen}
        filters={draft}
        resultCount={total}
        onChange={update}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );
}

function ProfileResults({ search }: { search: MarketplaceSearchResult }) {
  if (search.profileTotal === 0) return null;
  const matches = Object.fromEntries(Object.entries(search.profileMatches).map(([id, match]) => [id, match.label]));
  return (
    <section className="flex flex-col gap-4">
      <div><h2 className="text-[19px] font-bold text-ink">Profesionales y empresas</h2><p className="text-[13px] text-ink-soft">{search.profileTotal} {search.profileTotal === 1 ? "perfil" : "perfiles"}</p></div>
      <ProfileGrid profiles={search.profiles} matches={matches} initialVisible={6} showAd />
    </section>
  );
}

function ServiceResults({ search }: { search: MarketplaceSearchResult }) {
  if (search.serviceTotal === 0) return null;
  const matches = Object.fromEntries(Object.entries(search.cardMatches).map(([id, match]) => [id, match.label]));
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[19px] font-bold text-ink">Propuestas de servicio</h2>
        <p className="text-[13px] text-ink-soft">
          {search.serviceTotal} {search.serviceTotal === 1 ? "oferta" : "ofertas"} de {search.serviceProviderTotal} {search.serviceProviderTotal === 1 ? "proveedor" : "proveedores"}
        </p>
      </div>
      <ServiceCardGrid key={`${search.interpretation.normalized}:${search.serviceCards.map((card) => card.id).join("|")}`} cards={search.serviceCards} matches={matches} initialVisible={6} />
    </section>
  );
}

function NoResults({ filters, search }: { filters: SearchFilters; search: MarketplaceSearchResult }) {
  const hasDiscovery = search.discoveryProfiles.length > 0 || search.discoveryCards.length > 0;
  return (
    <div className="flex flex-col gap-7">
      <EmptyState title="No encontramos lo que buscás">
        <p>Probá reformular la búsqueda o elegí una de estas opciones.</p>
        {search.suggestedActions.length ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {search.suggestedActions.map((action) => (
              <Link key={action.href} href={action.href} className="rounded-input bg-brand-100 px-3 py-2 font-semibold text-brand-800 hover:bg-[#E4E9F2]">
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}

      </EmptyState>

      {hasDiscovery ? (
        <section className="flex flex-col gap-5" aria-labelledby="discovery-title">
          <div>
            <h2 id="discovery-title" className="text-[21px] font-bold text-ink">
              No encontramos lo que buscás, pero esto podría interesarte
            </h2>
            <p className="text-[14px] text-ink-soft">
              {search.discoveryRelated
                ? "Son opciones de especialidades relacionadas; consultá con el proveedor si realiza el trabajo específico."
                : "Estas opciones son para seguir explorando y no coinciden con tu búsqueda."}
            </p>
          </div>
          {search.discoveryCards.length ? (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-ink">Propuestas para explorar</h3>
              <ServiceCardGrid cards={search.discoveryCards} initialVisible={6} />
            </div>
          ) : null}
          {search.discoveryProfiles.length ? (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-ink">Profesionales a quienes podés consultar</h3>
              <ProfileGrid profiles={search.discoveryProfiles} initialVisible={6} />
            </div>
          ) : null}
        </section>
      ) : null}

      {search.discoveryLinks.length ? (
        <nav aria-label="Servicios para explorar" className="rounded-card border border-line bg-white p-5">
          <h2 className="text-[17px] font-bold text-ink">Explorá otros servicios</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {search.discoveryLinks.map((link) => (
              <Link key={link.href} href={link.href} title={link.detail} className="rounded-full border border-line bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-brand-800 hover:border-line-strong">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
      {!filters.query.trim() ? null : (
        <p className="text-center text-[12.5px] text-ink-faint">Las propuestas para explorar no se suman a tus resultados.</p>
      )}
    </div>
  );
}

/** Limpia todo menos el texto buscado. */
function emptyExceptQuery(filters: SearchFilters): Partial<SearchFilters> {
  return {
    resultKinds: [],
    locationIds: [],
    specialtyIds: [],
    minRating: null,
    paymentMethods: [],
    serviceModes: [],
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
