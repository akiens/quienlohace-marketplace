"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { filtersToQuery, searchHref } from "@/lib/query";
import { countActiveFilters } from "@/lib/search";
import type { SearchFilters } from "@/types";
import { Icon, SECONDARY_SURFACE } from "@/components/ui";

const QUICK_SEARCHES = [
  "Electricista",
  "Plomero",
  "Limpieza",
  "Fletes",
  "Peluquería",
];

type SearchPanelProps = {
  /** Los filtros vigentes. Es de dónde parte el borrador del panel. */
  filters: SearchFilters;
  /**
   * Avisa que se pidió buscar: al enviar el formulario o al tocar una búsqueda
   * frecuente. **No** se llama mientras se escribe ni al elegir en los
   * desplegables — eso queda en el borrador hasta que se confirme.
   */
  onSubmit?: (filters: SearchFilters) => void;
  /**
   * Avisa cada cambio del borrador, sin buscar.
   *
   * Lo usa la página de resultados para que el panel lateral de filtros parta
   * de lo que se está escribiendo: sin esto, aplicar un filtro ahí descartaba
   * el texto tipeado y todavía no confirmado.
   */
  onDraftChange?: (filters: SearchFilters) => void;
  variant?: "hero" | "compact";
  /**
   * Sin fondo propio ni encabezado: sólo la fila de controles.
   *
   * La portada lo pone sobre su slider, con la bienvenida encima. El degradado
   * del panel taparía la foto, y el título quedaría dicho dos veces.
   */
  bare?: boolean;
  title?: string;
  subtitle?: string;
  onOpenFilters?: () => void;
};

/**
 * Buscador global. La jerarquía Departamento → Localidad → Barrio se arma en la
 * UI a partir de la colección plana de ubicaciones.
 */
export function SearchPanel({
  filters,
  onSubmit,
  onDraftChange,
  variant = "hero",
  bare = false,
  title = "¿Qué servicio necesitás?",
  subtitle = "Encontrá profesionales y empresas verificadas en todo Uruguay.",
  onOpenFilters,
}: SearchPanelProps) {
  const router = useRouter();
  const [openPopover, setOpenPopover] = useState<"location" | "category" | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Lo que se está armando, todavía sin buscar.
   *
   * Escribir en el campo o elegir una categoría no dispara la búsqueda: se
   * acumula acá y recién sale al tocar "Buscar". Antes cada tecla y cada
   * selección iban a la URL, así que el servidor buscaba con frases a medio
   * escribir y la lista de resultados parpadeaba mientras se tipeaba.
   */
  const [draft, setDraft] = useState<SearchFilters>(filters);

  /*
   * Si los filtros vigentes cambian por fuera del panel —se quita un chip, se
   * limpia todo, se navega hacia atrás— el borrador los adopta: si no, el
   * panel seguiría mostrando lo de antes y la próxima búsqueda lo resucitaría.
   *
   * La comparación es sobre la query armada, que es la forma canónica de un
   * conjunto de filtros y ya se usa para la URL.
   */
  const applied = filtersToQuery(filters);
  const [syncedTo, setSyncedTo] = useState(applied);
  if (syncedTo !== applied) {
    setSyncedTo(applied);
    setDraft(filters);
  }

  /** Escribe el borrador y lo avisa hacia afuera, que son siempre juntos. */
  function updateDraft(next: SearchFilters) {
    setDraft(next);
    onDraftChange?.(next);
  }

  // Con `bare` no hay encabezado que mostrar: sólo los controles.
  const isHero = variant === "hero" && !bare;
  /*
   * La versión que va pegada al encabezado. En mobile se aprieta hasta ser una
   * sola caja —el campo, y adentro los dos botones con solo su icono—: ahí el
   * buscador es una herramienta de paso y no puede comerse media pantalla.
   */
  const isCompact = variant === "compact";
  /*
   * El contador del botón "Filtros" cuenta el borrador y no lo aplicado: si
   * contara lo aplicado, elegir una categoría en el buscador no movería el
   * número hasta tocar "Buscar" y parecería que la selección no tomó.
   */
  const activeFilterCount = countActiveFilters(draft);

  useEffect(() => {
    if (!openPopover) return;

    function onPointerDown(event: PointerEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpenPopover(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPopover(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPopover]);

  function submit() {
    setOpenPopover(null);
    /*
     * En la página de resultados quien manda es `onSubmit`: reemplaza la URL
     * sin apilar una entrada de historial por búsqueda. Sin él —en la portada—
     * se navega a `/buscar`.
     */
    if (onSubmit) onSubmit(draft);
    else router.push(searchHref(draft));
  }

  /*
   * Sobre la foto de la portada el panel no pone fondo ni ancho de `shell`: lo
   * enmarca quien lo monta. En el resto del sitio sí trae su franja degradada.
   */
  const Frame = bare ? BareFrame : GradientFrame;

  return (
    <Frame panelRef={panelRef} isHero={isHero}>
        {isHero ? (
          <div className="mb-[18px] flex flex-col gap-1.5">
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-.8px] text-white lg:text-[34px]">
              {title}
            </h1>
            <p className="text-[15px] text-[#C3CEE2]">{subtitle}</p>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className={`flex rounded-card bg-white shadow-[0_12px_30px_-12px_rgba(10,20,40,.45)] lg:flex-row lg:gap-2 lg:p-2.5 ${
            /*
             * En mobile el compacto es una sola caja: los dos botones van
             * adentro del campo y el padding baja a 2px, que es todo lo que
             * hace falta para que el borde no toque los botones. El resto
             * conserva la fila de siempre, apilada.
             */
            isCompact ? "gap-1 p-0.5" : "flex-col gap-2 p-2.5"
          }`}
          role="search"
        >
          <div
            className={`flex h-12 min-w-0 flex-1 items-center rounded-input border border-[#EAECF0] bg-surface-muted p-3 ${
              /*
               * Adentro de la caja compacta el campo ya está enmarcado por
               * ella: sin borde ni fondo propios sería una caja dentro de otra.
               * En desktop vuelve a ser un campo suelto en la fila.
               */
              isCompact
                ? "border-transparent bg-transparent px-2.5 lg:border-[#EAECF0] lg:bg-surface-muted lg:px-3"
                : ""
            }`}
          >
            <input
              type="search"
              value={draft.query}
              onChange={(event) =>
                updateDraft({ ...draft, query: event.target.value })
              }
              placeholder="Buscar profesionales, empresas o servicios..."
              aria-label="Buscar profesionales, empresas o servicios"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft"
            />
          </div>

          {/*
            La fila es sólo esto: el campo, "Filtros" y "Buscar".

            La ubicación y el rubro tenían acá su propio desplegable y se
            mudaron al panel de la derecha, con el resto de los criterios: eran
            dos de cinco filtros y no se entendía por qué esos dos estaban a la
            vista y los otros escondidos. Ahora el buscador pide lo que se
            escribe, y todo lo que se elige de una lista vive en un solo lugar.
          */}
          <div className={`flex ${isCompact ? "flex-none gap-1 lg:gap-2" : "gap-2"}`}>
            {onOpenFilters ? (
              <button
                type="button"
                onClick={onOpenFilters}
                /*
                 * En el compacto de mobile el texto se va y queda el icono: el
                 * ancho que ahorra se lo lleva "Buscar", que es la acción que
                 * se toca. `aria-label` mantiene el nombre para quien no ve el
                 * icono; en desktop vuelve la etiqueta escrita.
                 */
                aria-label={
                  isCompact
                    ? `Filtros${activeFilterCount > 0 ? ` (${activeFilterCount} activos)` : ""}`
                    : undefined
                }
                className={`relative flex h-12 flex-none items-center justify-center gap-2 rounded-input text-[14.5px] font-semibold ${
                  isCompact ? "w-11 px-0 lg:w-auto lg:px-3.5" : "px-3.5"
                } ${SECONDARY_SURFACE}`}
              >
                <Icon name="tune" className="text-[20px] text-brand-800" />
                <span className={isCompact ? "hidden lg:inline" : undefined}>
                  Filtros
                </span>
                {activeFilterCount > 0 ? (
                  <span
                    className={`flex items-center justify-center rounded-full bg-accent font-bold text-ink ${
                      /*
                       * Sin lugar al lado del icono, el contador se mete en la
                       * esquina del propio botón. Va adentro y no desbordando:
                       * el formulario compacto sólo deja 2px de aire y un badge
                       * saliente quedaría cortado por el borde redondeado.
                       */
                      isCompact
                        ? "absolute right-0.5 top-0.5 h-4 min-w-[16px] px-1 text-[10.5px] lg:static lg:h-5 lg:min-w-[20px] lg:px-1.5 lg:text-[12px]"
                        : "h-5 min-w-[20px] px-1.5 text-[12px]"
                    }`}
                  >
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}

            <button
              type="submit"
              aria-label={isCompact ? "Buscar" : undefined}
              className={`flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-input bg-brand-800 text-[15px] font-bold text-white transition-colors hover:bg-brand-950 ${
                isCompact ? "w-11 flex-none px-0 lg:w-auto lg:flex-1 lg:px-6" : "flex-1 px-6"
              }`}
            >
              {/*
                El icono de la lupa vive acá y no en el campo: adentro del
                input era decoración —no se puede tocar— y repetía lo que ya
                dice el placeholder. En el botón nombra la acción.
              */}
              <Icon name="search" className="text-[20px]" />
              <span className={isCompact ? "hidden lg:inline" : undefined}>
                Buscar
              </span>
            </button>
          </div>
        </form>

        {isHero ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[#AFBDD6]">
              Búsquedas frecuentes:
            </span>
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  // Un atajo busca de una: es lo que se espera al tocarlo.
                  const next = { ...draft, query: term };
                  updateDraft(next);
                  if (onSubmit) onSubmit(next);
                  else router.push(searchHref(next));
                }}
                className="rounded-full border border-white/20 bg-white/[.13] px-2.5 py-1 text-[13px] font-semibold text-white transition-colors hover:bg-white/25"
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
    </Frame>
  );
}

/** El envoltorio de siempre: franja degradada a lo ancho del sitio. */
function GradientFrame({
  panelRef,
  isHero,
  children,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  isHero: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-visible bg-brand-gradient">
      <div className="pointer-events-none absolute inset-0 bg-hatch" />
      <div
        ref={panelRef}
        className={`shell relative ${isHero ? "py-5 lg:py-6" : "p-1"}`}
      >
        {children}
      </div>
    </section>
  );
}

/** Sin fondo ni ancho propio: lo enmarca quien lo monta. */
function BareFrame({
  panelRef,
  children,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  isHero: boolean;
  children: React.ReactNode;
}) {
  return (
    <div ref={panelRef} className="relative">
      {children}
    </div>
  );
}
