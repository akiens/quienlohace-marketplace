import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next no puede decidir estático/dinámico por query string dentro de una
 * misma Page. La portada queda en `/buscar`; una URL con criterios conserva su
 * dirección pública pero se resuelve con la ruta dinámica interna.
 */
export function proxy(request: NextRequest) {
  // `_rsc` y otros parámetros internos de Next no convierten la portada en
  // una búsqueda. Sólo los criterios públicos disparan el flujo dinámico.
  const searchKeys = ["q", "tipo", "loc", "esp", "rating", "pago", "modo", "geo", "page"];
  if (!searchKeys.some((key) => request.nextUrl.searchParams.has(key))) {
    return NextResponse.next();
  }
  const destination = request.nextUrl.clone();
  destination.pathname = "/busqueda-dinamica";
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/buscar",
};
