"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui";

/**
 * Cuántos rubros se ven en mobile antes de pedir el resto.
 *
 * Seis son tres filas de dos: alcanzan para que se entienda de qué va la
 * sección y qué clase de cosas se pueden buscar, sin empujar el resto de la
 * portada fuera de la pantalla.
 */
const MOBILE_VISIBLE = 6;

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
 * La grilla de rubros de la portada, recortada en mobile.
 *
 * Son veinte. En desktop entran en cuatro filas de cinco y se ven de un
 * vistazo, pero en mobile van de a dos: diez filas que dejan los destacados,
 * "cómo funciona" y los mejor calificados debajo de una pared de tarjetas.
 * Ahí se muestran seis y el resto sale con "Mostrar más".
 */
export function SectorGrid({ sectors }: { sectors: SectorCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = sectors.length - MOBILE_VISIBLE;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sectors.map((sector, index) => (
          <Link
            key={sector.id}
            href={`/categorias/${sector.slug}`}
            /*
             * Las de más allá de seis se ocultan sólo hasta `lg`, y sólo
             * mientras esté plegado.
             *
             * Es `max-lg:hidden` y no un `slice` del arreglo: cortar la lista
             * dejaría catorce rubros fuera del HTML, y en desktop —donde
             * entran de sobra— no aparecerían hasta que hidrate. Ocultarlos
             * por CSS los deja en el documento, que es lo que ve el buscador
             * y lo que se ve con JavaScript todavía en camino.
             */
            className={`group flex flex-col gap-2.5 rounded-card border border-line bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#C6CEDC] hover:shadow-card-hover ${
              !expanded && index >= MOBILE_VISIBLE ? "max-lg:hidden" : ""
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
        El botón es cosa de mobile: en desktop están los veinte a la vista y no
        habría nada que mostrar. Se va al desplegar —ya no queda nada detrás, y
        un "Mostrar menos" volvería a esconder lo que se acaba de pedir ver—.
      */}
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-input border border-[#DAE0EC] bg-brand-100 text-[14.5px] font-semibold text-brand-800 transition-colors hover:border-[#C6CEDC] hover:bg-[#E4E9F2] lg:hidden"
        >
          Mostrar {hiddenCount} rubros más
          <Icon name="expand_more" className="text-[20px]" />
        </button>
      ) : null}
    </>
  );
}
