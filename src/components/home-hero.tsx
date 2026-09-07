"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FiltersPanel } from "@/components/filters-panel";
import { SearchPanel } from "@/components/search-panel";
import { searchHref } from "@/lib/query";
import { EMPTY_FILTERS, type SearchFilters } from "@/types";

/**
 * Los oficios que se muestran de fondo, en orden.
 *
 * Las fotos viven en `public/home/` como archivos del proyecto y no como URLs
 * de un banco de imágenes: una foto remota depende de un servicio que puede
 * caerse o cambiar la licencia, y además obligaría a abrir ese dominio en la
 * configuración de imagenes de Next.
 *
 * Están en WebP y no en PNG: son fotos, y PNG guarda cada píxel exacto —algo
 * que sirve para un logo, no para una fotografía—. En WebP de calidad 92 la
 * diferencia contra el original es de 0,46% por píxel, invisible detrás del
 * velo oscuro del hero, y las seis pasan de 11,2 MB a 1,12 MB.
 *
 * `alt` queda vacío a propósito: son decorativas y el texto de bienvenida ya
 * dice de qué se trata. Anunciar "foto de un electricista" cinco veces sólo
 * estorba a quien usa lector de pantalla.
 */
const SLIDES = [
  { src: "/home/electricista.webp", label: "Electricidad" },
  { src: "/home/plomero.webp", label: "Plomería y sanitaria" },
  { src: "/home/fletes.webp", label: "Fletes y mudanzas" },
  { src: "/home/seguridad.webp", label: "Seguridad" },
  { src: "/home/tecnologia.webp", label: "Tecnología" },
  { src: "/home/construccion.webp", label: "Construcción" },
];

/** Cuánto dura cada foto en pantalla. */
const SLIDE_MS = 5000;

/**
 * La portada: un slider de oficios de fondo, y encima la bienvenida con el
 * buscador en el medio de la pantalla.
 *
 * El slider es sólo fondo. Por eso no lleva controles de navegación ni
 * enlaces: lo que hay que hacer en esta pantalla es buscar, y unas flechas
 * competirían con el campo que está justo al lado. Se mueve solo, y se detiene
 * si la persona pidió menos animación.
 */
export function HomeHero() {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    /*
     * `prefers-reduced-motion` no es un detalle de accesibilidad opcional acá:
     * un fondo que cambia solo cada cinco segundos es exactamente lo que esa
     * preferencia pide evitar. Con ella activa se queda en la primera foto.
     */
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const id = setInterval(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      SLIDE_MS,
    );
    return () => clearInterval(id);
  }, []);

  const search = (filters: SearchFilters) => {
    setDraft(filters);
    router.push(searchHref(filters));
  };

  return (
    <>
      {/*
        Alto: todo el viewport que queda libre debajo del encabezado —61px,
        que son los `h-[60px]` de su fila más el borde inferior—. Antes era un
        `clamp` topado en 620px, así que en pantallas altas la foto cortaba a
        media altura y quedaba una franja blanca antes de las categorías.

        `svh` y no `vh`: en el navegador de un celular `100vh` cuenta la barra
        de direcciones que todavía está en pantalla, y el hero arrancaba más
        alto que lo visible. `min-h` y no `h`: si el contenido crece —pantalla
        baja en horizontal, texto más grande— el hero se estira en vez de
        recortarlo.
      */}
      <section className="relative isolate flex min-h-[calc(100svh-61px)] flex-col justify-center overflow-hidden">
        {/* El slider, detrás de todo. */}
        <div aria-hidden className="absolute inset-0 -z-10">
          {SLIDES.map((slide, i) => (
            <Image
              key={slide.src}
              src={slide.src}
              alt=""
              fill
              // La primera se carga con prioridad: es parte de lo que se ve al
              // entrar y define el LCP de la portada.
              priority={i === 0}
              sizes="100vw"
              className={`object-cover transition-opacity duration-1000 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

          {/*
           * Un velo oscuro sobre la foto. No es estética: sin él, el texto
           * blanco y el buscador quedan ilegibles sobre las zonas claras de
           * algunas fotos, y cambia con cada slide.
           */}
          <div className="absolute inset-0 bg-brand-950/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/40 via-transparent to-brand-950/60" />
        </div>

        <div className="shell flex flex-col items-center gap-6 py-12 text-center lg:py-16">
          {/*
            `max-w-2xl` alcanzaba para el párrafo pero partía el título en dos
            renglones en desktop. El ancho ahora lo pone cada uno: el título va
            entero en una línea (`whitespace-nowrap` desde lg, con el cuerpo de
            letra bajado a 40px para que entre en portátiles de 1280) y el
            párrafo conserva su medida de lectura.
          */}
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-.8px] text-white lg:whitespace-nowrap lg:text-[40px] xl:text-[44px]">
              Encontrá al profesional que necesitás
            </h1>
            <p className="max-w-2xl text-[16px] text-[#D5DEEE] lg:text-[18px]">
              Electricistas, plomeros, fletes, seguridad, tecnología y
              construcción. Profesionales y empresas de todo Uruguay, en un
              solo lugar.
            </p>
          </div>

          {/*
           * El buscador va suelto sobre la foto: `SearchPanel` trae su propio
           * fondo degradado, que acá taparía el slider. Por eso `bare`.
           */}
          <div className="w-full max-w-3xl">
            {/*
              `filters` es el borrador y no `EMPTY_FILTERS`: lo elegido en el
              panel lateral tiene que volver acá, que es donde se ve el
              contador de filtros puestos.
            */}
            <SearchPanel
              filters={draft}
              onSubmit={search}
              onDraftChange={setDraft}
              variant="hero"
              bare
              onOpenFilters={() => setFiltersOpen(true)}
            />
          </div>
        </div>
      </section>

      {/* Sin `resultCount`: todavía no hay búsqueda hecha. */}
      <FiltersPanel
        open={filtersOpen}
        filters={draft}
        onChange={setDraft}
        onSubmit={() => search(draft)}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );
}
