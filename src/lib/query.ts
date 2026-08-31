import { EMPTY_FILTERS, type PaymentMethod, type SearchFilters } from "@/types";
import { MAX_LOCATIONS, MAX_SUBCATEGORIES } from "@/types";

/**
 * Los filtros viven en la URL: así una búsqueda se puede compartir, volver
 * atrás funciona y el estado sobrevive a un refresh.
 */

const PAYMENT_METHODS: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Otros",
];

function list(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export function filtersFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): SearchFilters {
  const read = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rating = Number(read("rating"));

  return {
    query: read("q") ?? "",
    locationIds: list(read("loc")).slice(0, MAX_LOCATIONS),
    subcategoryIds: list(read("sub")).slice(0, MAX_SUBCATEGORIES),
    minRating: Number.isFinite(rating) && rating > 0 ? rating : null,
    paymentMethods: list(read("pago")).filter((p): p is PaymentMethod =>
      PAYMENT_METHODS.includes(p as PaymentMethod),
    ),
    useMyLocation: read("geo") === "1",
  };
}

/** Serializa sólo lo que difiere del estado vacío, para URLs limpias. */
export function filtersToQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();

  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.locationIds.length) params.set("loc", filters.locationIds.join(","));
  if (filters.subcategoryIds.length)
    params.set("sub", filters.subcategoryIds.join(","));
  if (filters.minRating !== null) params.set("rating", String(filters.minRating));
  if (filters.paymentMethods.length)
    params.set("pago", filters.paymentMethods.join(","));
  if (filters.useMyLocation) params.set("geo", "1");

  return params.toString();
}

export function searchHref(filters: SearchFilters): string {
  const query = filtersToQuery(filters);
  return query ? `/buscar?${query}` : "/buscar";
}

export { EMPTY_FILTERS };
