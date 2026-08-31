"use client";

import { useState } from "react";

import { SearchPanel } from "@/components/search-panel";
import { EMPTY_FILTERS, type SearchFilters } from "@/types";

/** Buscador del home: mantiene el estado local hasta que se envía la búsqueda. */
export function HomeHero() {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);

  return <SearchPanel filters={filters} onChange={setFilters} variant="hero" />;
}
