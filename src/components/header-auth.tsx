"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";

/**
 * Header con estado de sesión.
 *
 * La sesión se consulta desde el cliente a `/api/session`. Leer la cookie en
 * el layout raíz volvería dinámico todo el sitio y las páginas estáticas —la
 * base del SEO— dejarían de pregenerarse.
 *
 * El primer render muestra el header de visitante, que es también lo que ve
 * quien no tiene sesión: para el contenido público no cambia nada, y los
 * enlaces del panel aparecen apenas responde la consulta.
 */
export function HeaderWithAuth() {
  const [signedIn, setSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // `ignore` evita aplicar una respuesta tardía tras desmontar.
    let ignore = false;

    fetch("/api/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const session = data as { signedIn?: boolean } | null;
        // Se aplica el valor recibido, también cuando es `false`: al cerrar
        // sesión el header debe volver a mostrar «Entrar» en vez de quedarse
        // con el estado anterior.
        if (!ignore) setSignedIn(Boolean(session?.signedIn));
      })
      .catch(() => {
        // Si falla, queda el header de visitante: nunca bloquea la navegación.
      });

    return () => {
      ignore = true;
    };
    // Se vuelve a consultar en cada navegación: entrar y salir terminan en un
    // `redirect`, y así el header refleja el estado nuevo sin recargar.
  }, [pathname]);

  return <SiteHeader signedIn={signedIn} />;
}
