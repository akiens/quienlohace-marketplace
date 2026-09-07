"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui";

/**
 * Cuántos rubros se ven plegado, por ancho de pantalla.
 *
 * En los dos casos es "las primeras filas y nada más", pero las filas no miden
 * lo mismo: la grilla va de a dos columnas en mobile, tres desde `sm` y cinco
 * desde `lg`. Así que el corte se cuenta en tarjetas y no en filas.
 *
 * - `MOBILE`: 6 = tres filas de dos.
 * - `DESKTOP`: 10 = dos filas de cinco.
 *
 * Los dos números coinciden en el tramo del medio (`sm`, tres columnas): seis
 * son dos filas justas, así que ahí no se ve ningún hueco a medio llenar.
 */
const MOBILE_VISIBLE = 6;
const DESKTOP_VISIBLE = 10;

export type SectorCard = {
  id: string;
  slug: string;
  short: string;
  icon: string;
  /**
   * Cuántas especialidades tiene el rubro. Llega contado desde el servidor:
   * es un dato del catálogo y no cambia con la interacción, así que no hace
   * falta mandar la taxonomía entera al navegador para volver a contarlo.
   */
  specialtyCount: number;
};

/**
 * Cómo se esconde la tarjeta número `index` mientras la grilla está plegada.
 *
 * Devuelve la clase que la oculta en los anchos donde sobra, o `""` si entra
 * en todos. Son tres tramos:
 *
 * - Antes de `MOBILE_VISIBLE`: se ve siempre.
 * - Entre los dos cortes: sobra en mobile pero entra en las dos filas de
 *   desktop, así que se oculta sólo hasta `lg`.
 * - Después de `DESKTOP_VISIBLE`: sobra en todos lados.
 *
 * Es CSS y no un `slice` del arreglo a propósito: cortar la lista dejaría diez
 * rubros fuera del HTML, y son la puerta de entrada al SEO del sitio. Ocultar
 * por ancho también evita tener que adivinar en el servidor con qué pantalla
 * se va a abrir la página —no hay forma de saberlo— y deja el mismo HTML
 * sirviendo a las dos.
 */
function hiddenClass(index: number): string {
  if (index < MOBILE_VISIBLE) return "";
  if (index < DESKTOP_VISIBLE) return "max-lg:hidden";
  return "hidden";
}

/**
 * La grilla de rubros de la portada, recortada mientras esté plegada.
 *
 * Son veinte, y de largo tapan lo que viene después —destacados, cómo
 * funciona, mejor calificados—. Plegada muestra las primeras filas y el resto
 * sale con "Mostrar más", que vuelve a plegarse con "Mostrar menos": quien
 * abrió para mirar puede devolver la portada a como estaba.
 */
export function SectorGrid({ sectors }: { sectors: SectorCard[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sectors.map((sector, index) => (
          <Link
            key={sector.id}
            href={`/categorias/${sector.slug}`}
            className={`group flex flex-col gap-2.5 rounded-card border border-line bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#C6CEDC] hover:shadow-card-hover ${
              expanded ? "" : hiddenClass(index)
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-100">
              <Icon name={sector.icon} className="text-[21px] text-brand-800" />
            </span>
            <span className="text-[14.5px] font-semibold leading-tight text-ink">
              {sector.short}
            </span>
            {/*
              Cuántas especialidades tiene el rubro, que es un dato real del
              catálogo. Antes decía "N profesionales" con un número fijo
              escrito a mano, que no salía de ningún lado y envejecía mal.
            */}
            <span className="text-[12.5px] text-ink-soft">
              {sector.specialtyCount} especialidades
            </span>
          </Link>
        ))}
      </div>

      {/*
        El botón va en todos los anchos: plegada, la grilla esconde rubros
        tanto en mobile como en desktop.

        No dice cuántos faltan. Serían dos números distintos —catorce en mobile,
        diez en desktop— y el texto se escribe una sola vez para las dos
        pantallas; poner uno de los dos lo haría mentir en la mitad de los
        casos. `aria-expanded` es lo que le dice a un lector de pantalla en qué
        estado está, que es la parte que importa.
      */}
      {sectors.length > MOBILE_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-input border border-[#DAE0EC] bg-brand-100 text-[14.5px] font-semibold text-brand-800 transition-colors hover:border-[#C6CEDC] hover:bg-[#E4E9F2]"
        >
          {expanded ? "Mostrar menos" : "Mostrar más"}
          <Icon
            name="expand_more"
            className={`text-[20px] transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </>
  );
}
