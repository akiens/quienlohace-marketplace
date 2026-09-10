import type { Metadata } from "next";

import { SearchExperience } from "@/components/search-experience";
import { filtersFromParams } from "@/lib/query";
import { searchMarketplace } from "@/application/search";

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

  const search = await searchMarketplace(filters);

  return <SearchExperience filters={filters} search={search} />;
}
