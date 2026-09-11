import type { Metadata } from "next";

import { SearchExperience } from "@/components/search-experience";
import { EMPTY_FILTERS, getPreparedSearchResult } from "@/application/showcase";

export const metadata: Metadata = {
  title: "Buscar profesionales y servicios",
  description:
    "Buscá profesionales, empresas y propuestas de servicio por rubro y zona en todo Uruguay.",
};

/** Portada estática: no lee la URL, D1 ni ninguna API de tiempo de pedido. */
export default function SearchLandingPage() {
  return (
    <SearchExperience
      filters={EMPTY_FILTERS}
      search={getPreparedSearchResult()}
    />
  );
}
