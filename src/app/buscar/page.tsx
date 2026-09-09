import type { Metadata } from "next";

import { SearchExperience } from "@/components/search-experience";
import { filtersFromParams } from "@/lib/query";
import { countProfiles, searchProfiles } from "@/application/profiles";
import { countServiceCards, searchServiceCards } from "@/application/service-cards";

/** Los resultados dependen de los filtros y de la base: siempre por pedido. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar profesionales y servicios",
  description:
    "Buscá profesionales, empresas y propuestas de servicio por rubro y zona en todo Uruguay.",
};

/**
 * Los resultados se calculan en el servidor a partir de la URL, así la página
 * llega con HTML útil (indexable y sin parpadeo de carga). Los controles
 * interactivos viven en el cliente y actualizan la query string.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = filtersFromParams(params);

  // `results` trae sólo la primera tanda; `total` es cuántos coinciden de
  // verdad, para no informar el tamaño de la página como si fuera el total.
  const includeServices =
    filters.resultKinds.length === 0 || filters.resultKinds.includes("service");
  const [results, profileTotal, serviceCards, serviceTotal] = await Promise.all([
    searchProfiles(filters),
    countProfiles(filters),
    includeServices ? searchServiceCards(filters) : Promise.resolve([]),
    includeServices ? countServiceCards(filters) : Promise.resolve(0),
  ]);

  return <SearchExperience filters={filters} results={results} profileTotal={profileTotal} serviceCards={serviceCards} serviceTotal={serviceTotal} />;
}
