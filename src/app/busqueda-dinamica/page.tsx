import type { Metadata } from "next";

import { SearchExperience } from "@/components/search-experience";
import { filtersFromParams, searchPageFromParams } from "@/lib/query";
import { searchMarketplace } from "@/application/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar profesionales y servicios",
  description:
    "Buscá profesionales, empresas y propuestas de servicio por rubro y zona en todo Uruguay.",
};

/** Destino interno de `/buscar?...`; Proxy conserva la URL pública. */
export default async function DynamicSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const page = searchPageFromParams(params);
  const search = await searchMarketplace(filters, page);
  return <SearchExperience filters={filters} search={search} />;
}
