"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { runMarketplaceSearch } from "@/app/actions/search";
import { FiltersPanel } from "@/components/filters-panel";
import { TrackedResult } from "@/components/analytics/tracked-result";
import { ProfileCard, ProfileCardSkeleton } from "@/components/profile-card";
import { ServiceOfferCard } from "@/components/service-offer-card";
import { SearchPanel } from "@/components/search-panel";
import { SearchResultsSkeleton } from "@/components/search-results-skeleton";
import { filtersFromParams, paginatedSearchHref, searchCriteriaKey } from "@/lib/query";
import { initializeAnalytics, trackAnalytics } from "@/lib/analytics/client";
import { Button, EmptyState, Icon, PROVIDER_GRID } from "@/components/ui";
import type { MarketplaceSearchResult } from "@/application/search";
import {
  SERVICE_MODE_LABELS,
  type SearchFilters,
} from "@/types";

/**
 * Página de resultados. Los filtros viven en la URL: la búsqueda se puede
 * compartir y el botón "atrás" del navegador se comporta como se espera.
 * El filtrado ocurre en el servidor; acá sólo se manejan los controles.
 */
export function SearchExperience({
  filters: initialFilters,
  search: initialSearch,
}: {
  filters: SearchFilters;
  search: MarketplaceSearchResult;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState(initialSearch);
  const [draft, setDraft] = useState(initialFilters);
  const [pendingOperation, setPendingOperation] = useState<"search" | "load-more" | null>(null);
  const [repeatedSearchAttempt, setRepeatedSearchAttempt] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function execute(
    next: SearchFilters,
    page: number,
    options: {
      updateUrl: boolean;
      recordPending: boolean;
      operation: "search" | "load-more";
    },
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPendingOperation(options.operation);
    setSearchError(null);
    setRepeatedSearchAttempt(0);

    const href = paginatedSearchHref(next, page);
    const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    if (options.updateUrl) window.history.replaceState(null, "", href);
    if (options.recordPending) {
      try {
        sessionStorage.setItem("qlh:analytics:pending-search:v1", JSON.stringify({
          before: filters,
          after: next,
          previousSearchId: search.prepared ? undefined : search.analytics.searchId,
        }));
      } catch {}
    }

    try {
      const result = await runMarketplaceSearch(query);
      setFilters(result.filters);
      setDraft(result.filters);
      setSearch(result.search);
    } catch {
      setSearchError("No pudimos completar la búsqueda. Intentá nuevamente.");
    } finally {
      inFlight.current = false;
      setPendingOperation(null);
    }
  }

  const executeFromUrl = useCallback((query: string) => {
    const params = new URLSearchParams(query);
    const hasSearch = ["q", "tipo", "loc", "esp", "rating", "pago", "modo", "geo", "page"]
      .some((key) => params.has(key));
    if (!hasSearch) return;
    void (async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPendingOperation("search");
      setSearchError(null);
      try {
        const result = await runMarketplaceSearch(params.toString());
        setFilters(result.filters);
        setDraft(result.filters);
        setSearch(result.search);
      } catch {
        setSearchError("No pudimos completar la búsqueda. Intentá nuevamente.");
      } finally {
        inFlight.current = false;
        setPendingOperation(null);
      }
    })();
  }, []);

  useEffect(() => {
    executeFromUrl(window.location.search.slice(1));
    const restore = () => executeFromUrl(window.location.search.slice(1));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [executeFromUrl]);

  useEffect(() => {
    if (repeatedSearchAttempt === 0) return;
    const timeout = window.setTimeout(() => setRepeatedSearchAttempt(0), 5000);
    return () => window.clearTimeout(timeout);
  }, [repeatedSearchAttempt]);

  function submit(next: SearchFilters) {
    setDraft(next);
    if (!search.prepared && searchCriteriaKey(next) === searchCriteriaKey(filters)) {
      setRepeatedSearchAttempt((attempt) => attempt + 1);
      return;
    }
    void execute(next, 1, {
      updateUrl: true,
      recordPending: true,
      operation: "search",
    });
  }

  function submitSearchHref(href: string) {
    const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    submit(filtersFromParams(new URLSearchParams(query)));
  }

  return (
    <SearchExperienceContent
      filters={filters}
      search={search}
      draft={draft}
      loading={pendingOperation !== null}
      loadingMore={pendingOperation === "load-more"}
      repeatedSearchAttempt={repeatedSearchAttempt}
      searchError={searchError}
      onDraftChange={(next) => {
        setDraft(next);
        setRepeatedSearchAttempt(0);
      }}
      onSubmit={submit}
      onSearchHref={submitSearchHref}
      onDismissRepeated={() => setRepeatedSearchAttempt(0)}
      onLoadMore={() => void execute(filters, search.pagination.page + 1, {
        updateUrl: true,
        recordPending: false,
        operation: "load-more",
      })}
    />
  );
}

function SearchExperienceContent({
  filters,
  search,
  draft,
  loading,
  loadingMore,
  repeatedSearchAttempt,
  searchError,
  onDraftChange,
  onSubmit,
  onSearchHref,
  onDismissRepeated,
  onLoadMore,
}: {
  filters: SearchFilters;
  search: MarketplaceSearchResult;
  draft: SearchFilters;
  loading: boolean;
  loadingMore: boolean;
  repeatedSearchAttempt: number;
  searchError: string | null;
  onDraftChange: (filters: SearchFilters) => void;
  onSubmit: (filters: SearchFilters) => void;
  onSearchHref: (href: string) => void;
  onDismissRepeated: () => void;
  onLoadMore: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const recordedSearch = useRef<string | null>(null);

  const total = search.total;

  useEffect(() => {
    // La portada preparada es discovery, no una búsqueda enviada por alguien.
    // Además sus ids son estáticos y no corresponden a una ejecución en D1.
    if (search.prepared) return;
    if (recordedSearch.current === search.analytics.searchId) return;
    recordedSearch.current = search.analytics.searchId;
    void initializeAnalytics().then((ready) => {
      if (!ready) return;
      const pendingKey = "qlh:analytics:pending-search:v1";
      type PendingSearch = { before: SearchFilters; after: SearchFilters; previousSearchId?: string };
      let pending: PendingSearch | null = null;
      try {
        pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null") as PendingSearch | null;
        sessionStorage.removeItem(pendingKey);
      } catch {}
      if (search.pagination.page === 1) {
        trackAnalytics({
          eventName: "search_submitted", observationKind: "interaction", searchId: search.analytics.searchId,
          previousSearchId: pending?.previousSearchId,
          searchExecutionId: search.analytics.searchExecutionId, resultSetId: search.analytics.resultSetId,
          surface: "search_results", properties: { filters, reason: pending ? "filter" : "initial", normalizerVersion: 1 },
        });
      }
      if (pending && search.pagination.page === 1) {
        const keys = (Object.keys(pending.after) as Array<keyof SearchFilters>).filter((key) => JSON.stringify(pending?.before[key]) !== JSON.stringify(pending?.after[key]));
        if (keys.length) trackAnalytics({
          eventName: "search_filter_applied", observationKind: "interaction", searchId: search.analytics.searchId,
          searchExecutionId: search.analytics.searchExecutionId, resultSetId: search.analytics.resultSetId,
          surface: "search_results", properties: { changedFields: keys, before: pending.before, after: pending.after },
        });
      }
      trackAnalytics({
        eventName: "search_results_viewed", observationKind: "client_observation", searchId: search.analytics.searchId,
        searchExecutionId: search.analytics.searchExecutionId, resultSetId: search.analytics.resultSetId,
        listViewId: `list_${search.analytics.resultSetId}`, surface: "search_results",
        properties: { total: search.total, providerTotal: search.providerTotal, presentedCount: search.results.length },
      });
      trackAnalytics({
        eventName: "list_viewed", observationKind: "client_observation", searchId: search.analytics.searchId,
        resultSetId: search.analytics.resultSetId, listViewId: `list_${search.analytics.resultSetId}`,
        surface: "search_results", properties: { itemCount: search.results.length, listType: "search_results" },
      });
    });
  }, [filters, search]);

  return (
    <>
      {/*
        El panel avisa al buscar, no mientras se escribe: `onSubmit` y no
        `onChange`. Antes cada tecla y cada categoría elegida iban a la URL, y
        el servidor buscaba con frases a medio escribir.

        El panel lateral comparte ese borrador y sólo lo aplica desde su botón
        "Buscar".
      */}
      <SearchPanel
        filters={draft}
        onSubmit={onSubmit}
        onDraftChange={onDraftChange}
        variant="compact"
        onOpenFilters={() => setFiltersOpen(true)}
        loading={loading}
      />

      {loading && !loadingMore ? (
        <SearchResultsSkeleton />
      ) : (
        <div className="shell flex flex-col gap-5 py-8">
          {searchError ? (
            <div className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-[13.5px] text-danger" role="alert">
              {searchError}
            </div>
          ) : null}
          {repeatedSearchAttempt > 0 ? (
            <div
              key={repeatedSearchAttempt}
              className="flex items-center gap-2 rounded-card border border-brand-200 bg-brand-100 px-4 py-3 text-[13.5px] text-ink"
            >
              <Icon name="info" className="shrink-0 text-[19px] text-brand-800" />
              <p role="status" aria-live="polite" className="flex-1">
                No hace falta volver a buscar: no cambiaste el texto ni los filtros.
              </p>
              <button
                type="button"
                onClick={onDismissRepeated}
                aria-label="Cerrar aviso"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-white/70 hover:text-ink"
              >
                <Icon name="close" className="text-[17px]" />
              </button>
            </div>
          ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-[-.3px] text-ink sm:text-[25px]">
              {filters.query
                ? `Resultados para "${filters.query}"`
                : "Profesionales y servicios"}
            </h1>
            <p className="text-[14.5px] text-ink-soft">
              {total} {total === 1 ? "resultado" : "resultados"} de {search.providerTotal}{" "}
              {search.providerTotal === 1 ? "proveedor" : "proveedores"}
            </p>
          </div>
        </div>

        {search.interpretation.inferredMode && filters.serviceModes.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-brand-100 px-4 py-3 text-[13.5px] text-ink">
            <span>
              Interpretamos una preferencia por <strong>{SERVICE_MODE_LABELS[search.interpretation.inferredMode].toLocaleLowerCase("es")}</strong>.
            </span>
            <button
              type="button"
              onClick={() => onSubmit({ ...filters, serviceModes: [search.interpretation.inferredMode!] })}
              className="font-bold text-brand-800 underline underline-offset-2"
            >
              Aplicar este filtro
            </button>
          </div>
        ) : null}

          {total === 0 ? (
            <NoResults filters={filters} search={search} onSearchHref={onSearchHref} />
          ) : (
            <MixedResults
              key={`${search.interpretation.normalized}:${search.results.map((item) => `${item.kind}:${item.kind === "profile" ? item.profile.id : item.card.id}`).join("|")}`}
              search={search}
              loadingMore={loadingMore}
              onLoadMore={onLoadMore}
            />
          )}
        </div>
      )}

      {/* El panel edita el borrador y sólo `onSubmit` actualiza la URL. */}
      <FiltersPanel
        open={filtersOpen}
        filters={draft}
        onChange={onDraftChange}
        onSubmit={() => onSubmit(draft)}
        onClose={() => setFiltersOpen(false)}
        loading={loading}
      />
    </>
  );
}

function MixedResults({
  search,
  loadingMore,
  onLoadMore,
}: {
  search: MarketplaceSearchResult;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const shown = search.results;
  const remaining = search.pagination.remaining;
  const expectedCount = Math.min(search.pagination.pageSize, remaining);
  return (
    <section className="flex flex-col gap-6" aria-label="Resultados de búsqueda">
      {loadingMore ? (
        <p className="sr-only" role="status" aria-live="polite">
          Cargando {expectedCount} resultados más.
        </p>
      ) : null}
      <div className={PROVIDER_GRID}>
        {shown.map((item, index) => (
          <TrackedResult
            key={`${item.kind}:${item.kind === "profile" ? item.profile.id : item.card.id}`}
            className="relative min-w-0"
            resultKind={item.kind}
            position={index + 1}
            {...(search.prepared ? {} : {
              searchId: search.analytics.searchId,
              searchExecutionId: search.analytics.searchExecutionId,
              resultSetId: search.analytics.resultSetId,
            })}
            listViewId={search.prepared ? "list_prepared_search" : `list_${search.analytics.resultSetId}`}
            resultItemId={search.analytics.resultItemIds[index]!}
            entitySnapshotId={search.prepared ? undefined : search.analytics.snapshotIds[index]}
            entityType={item.kind === "service" ? "service_card" : "provider_profile"}
            providerProfileId={item.providerId}
            profileServiceId={item.kind === "service" ? item.card.serviceId : undefined}
            serviceCardId={item.kind === "service" ? item.card.id : undefined}
            specialtyId={item.kind === "service" ? item.card.specialtyId : item.profile.specialtyIds[0]}
            surface="search_results"
          >
            <span className="absolute left-2.5 top-2.5 z-[3] rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.45px] text-brand-800 shadow-sm">
              {item.kind === "service" ? "Carta de servicio" : "Proveedor"}
            </span>
            {item.kind === "service" ? (
              <ServiceOfferCard card={item.card} match={item.match.label} />
            ) : (
              <ProfileCard profile={item.profile} match={item.match.label} />
            )}
          </TrackedResult>
        ))}
        {loadingMore
          ? Array.from({ length: expectedCount }, (_, index) => (
              <ProfileCardSkeleton key={`load-more-${index}`} />
            ))
          : null}
      </div>
      {search.pagination.hasMore && !loadingMore ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onLoadMore}
          >
            Mostrar {Math.min(search.pagination.pageSize, remaining)} más
            <span className="text-ink-soft">({remaining} restantes)</span>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function NoResults({
  filters,
  search,
  onSearchHref,
}: {
  filters: SearchFilters;
  search: MarketplaceSearchResult;
  onSearchHref: (href: string) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <EmptyState title="No encontramos lo que buscás">
        <p>Probá reformular la búsqueda o elegí una de estas opciones.</p>
        {search.suggestedActions.length ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {search.suggestedActions.map((action) => (
              <button
                key={action.href}
                type="button"
                onClick={() => onSearchHref(action.href)}
                className="rounded-input bg-brand-100 px-3 py-2 font-semibold text-brand-800 hover:bg-[#E4E9F2]"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

      </EmptyState>

      {search.discoveryLinks.length ? (
        <nav aria-label="Servicios para explorar" className="rounded-card border border-line bg-white p-5">
          <h2 className="text-[17px] font-bold text-ink">Explorá otros servicios</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {search.discoveryLinks.map((link) => link.href.startsWith("/buscar") ? (
              <button
                key={link.href}
                type="button"
                onClick={() => onSearchHref(link.href)}
                title={link.detail}
                className="rounded-full border border-line bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-brand-800 hover:border-line-strong"
              >
                {link.label}
              </button>
            ) : (
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
