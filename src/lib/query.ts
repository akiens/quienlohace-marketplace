import {
  EMPTY_FILTERS,
  type PaymentMethod,
  type ResultKind,
  type SearchFilters,
  type ServiceModeCode,
} from "@/types";
import { locationExists } from "@/data/locations";
import { specialtyExists } from "@/data/taxonomy";

/**
 * Los filtros viven en la URL: así una búsqueda se puede compartir, volver
 * atrás funciona y el estado sobrevive a un refresh.
 */

/** Los códigos que persiste la base (TR-001), no sus etiquetas en español. */
const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
  "other",
];

const RESULT_KINDS: ResultKind[] = ["individual", "business", "service"];

const SERVICE_MODES: ServiceModeCode[] = ["at_customer", "at_business", "remote"];

function list(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((v) => v.trim()).filter(Boolean))];
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

  /*
   * Las listas no se recortan: el filtro dejó de tener tope, así que una URL
   * con muchas zonas o especialidades es válida. Lo que sí se hace es
   * descartar los códigos que no existen —`tipo`, `pago` y `modo` vienen de la
   * URL, que cualquiera puede escribir a mano—, porque un valor inventado no
   * filtraría nada y llegaría hasta la consulta.
   */
  return {
    query: (read("q") ?? "").trim().slice(0, 200),
    resultKinds: list(read("tipo")).filter((k): k is ResultKind =>
      RESULT_KINDS.includes(k as ResultKind),
    ),
    locationIds: list(read("loc")).filter(locationExists),
    specialtyIds: list(read("esp")).filter(specialtyExists),
    minRating: Number.isFinite(rating) && rating > 0 ? rating : null,
    paymentMethods: list(read("pago")).filter((p): p is PaymentMethod =>
      PAYMENT_METHODS.includes(p as PaymentMethod),
    ),
    serviceModes: list(read("modo")).filter((m): m is ServiceModeCode =>
      SERVICE_MODES.includes(m as ServiceModeCode),
    ),
    useMyLocation: read("geo") === "1",
  };
}

/** Serializa sólo lo que difiere del estado vacío, para URLs limpias. */
export function filtersToQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();

  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.resultKinds.length) params.set("tipo", filters.resultKinds.join(","));
  if (filters.locationIds.length) params.set("loc", filters.locationIds.join(","));
  if (filters.specialtyIds.length)
    params.set("esp", filters.specialtyIds.join(","));
  if (filters.minRating !== null) params.set("rating", String(filters.minRating));
  if (filters.paymentMethods.length)
    params.set("pago", filters.paymentMethods.join(","));
  if (filters.serviceModes.length) params.set("modo", filters.serviceModes.join(","));
  if (filters.useMyLocation) params.set("geo", "1");

  return params.toString();
}

export function searchHref(filters: SearchFilters): string {
  const query = filtersToQuery(filters);
  return query ? `/buscar?${query}` : "/buscar";
}

export { EMPTY_FILTERS };
