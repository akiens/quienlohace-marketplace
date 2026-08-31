import type { Metadata } from "next";

import { SearchExperience } from "@/components/search-experience";
import { filtersFromParams } from "@/lib/query";
import { countProviders, searchProviders } from "@/application/providers";

export const metadata: Metadata = {
  title: "Buscar profesionales",
  description:
    "Buscá profesionales y empresas de servicios por rubro y zona en todo Uruguay.",
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
  const [results, total] = await Promise.all([
    searchProviders(filters),
    countProviders(filters),
  ]);

  return <SearchExperience filters={filters} results={results} total={total} />;
}
