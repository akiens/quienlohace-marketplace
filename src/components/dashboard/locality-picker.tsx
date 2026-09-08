"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui";
import {
  COUNTRY_ID,
  COUNTRY_LABEL,
  departmentOf,
  getLocation,
  listDepartments,
  listLocalities,
} from "@/data/locations";
// El mismo `normalize` que usa el buscador de servicios: sin tildes ni
// mayúsculas, así "canelones" encuentra "Canelones".
import { normalize } from "@/data/services";

type Row = {
  id: string;
  label: string;
  /** Dato de apoyo a la derecha del nombre, como el departamento al buscar. */
  context?: string;
  /** Entra un nivel en vez de elegir. */
  navigates: boolean;
  icon: string;
};

/**
 * Elige un lugar del catálogo navegando por dentro de un solo desplegable.
 *
 * Reemplaza a los dos `select` dependientes —Departamento y Localidad— que
 * había antes. Eran dos campos para una sola respuesta, y el primero no era un
 * dato sino el camino para llegar al segundo: quien ya sabe que su local está
 * en Las Piedras no tendría por qué recordar antes que Las Piedras es
 * Canelones.
 *
 * Se abre mostrando los departamentos; al tocar uno, la lista se reemplaza por
 * sus localidades y aparece una fila para volver. Escribir busca localidades
 * de todo el país de una vez, sin pasar por el departamento.
 *
 * Sirve para las dos preguntas de ubicación del formulario, que se parecen
 * pero no son la misma, y es `granularity` lo que las separa:
 *
 * - `"locality"` para el local (BR-015): sólo una localidad es una respuesta.
 *   Un departamento entero no es un lugar donde se pueda atender a alguien,
 *   así que tocarlo navega y nada más.
 * - `"any"` para las zonas de trabajo (BR-016): ahí sí se puede cubrir todo el
 *   país o un departamento completo, y elegir ese nivel es la respuesta —no
 *   hace falta bajar hasta una localidad—.
 */
export function LocalityPicker({
  value,
  onChange,
  id,
  invalid = false,
  granularity = "locality",
  placeholder,
}: {
  /** Lo elegido, o "" si todavía no hay nada. */
  value: string;
  onChange: (locationId: string) => void;
  id?: string;
  /** Pinta el borde de error. Quién decide que lo es vive afuera. */
  invalid?: boolean;
  /** Hasta qué nivel es una respuesta válida. */
  granularity?: "locality" | "any";
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** El departamento que se está mirando por dentro, o "" en la raíz. */
  const [inside, setInside] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const anyLevel = granularity === "any";
  const selected = value ? getLocation(value) : undefined;
  const selectedDepartment = value ? departmentOf(value) : undefined;

  // Un clic afuera o Escape cierran, como cualquier desplegable del sitio.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /*
   * Lo que se lista ahora mismo.
   *
   * Con texto tipeado se buscan localidades de todo el país y el departamento
   * pasa a ser sólo contexto: buscar es el atajo de quien ya sabe el nombre y
   * no quiere navegar. Sin texto se muestran los departamentos o, si se entró
   * en uno, sus localidades.
   */
  const rows: Row[] = useMemo(() => {
    const needle = normalize(query);

    if (needle) {
      return listDepartments()
        .flatMap((department) =>
          listLocalities(department.id).map((locality) => ({
            id: locality.id,
            label: locality.name,
            context: department.name,
            navigates: false,
            icon: "location_on",
          })),
        )
        .filter((row) => normalize(row.label).includes(needle))
        .slice(0, 50);
    }

    if (inside) {
      const department = getLocation(inside);
      return [
        /*
         * Cubrir el departamento entero, cuando eso es una respuesta. Va
         * primero y no perdido entre sus localidades: es lo más amplio de esta
         * pantalla y quien entró buscando "todo Canelones" no debería tener
         * que recorrer sesenta pueblos para descartarlos.
         */
        ...(anyLevel && department
          ? [
              {
                id: department.id,
                label: `Todo ${department.name}`,
                navigates: false,
                icon: "map",
              },
            ]
          : []),
        ...listLocalities(inside).map((locality) => ({
          id: locality.id,
          label: locality.name,
          navigates: false,
          icon: "location_on",
        })),
      ];
    }

    return [
      // Cobertura nacional: la respuesta más amplia, arriba de todo.
      ...(anyLevel
        ? [
            {
              id: COUNTRY_ID,
              label: `Todo ${COUNTRY_LABEL}`,
              navigates: false,
              icon: "public",
            },
          ]
        : []),
      ...listDepartments().map((department) => ({
        id: department.id,
        label: department.name,
        navigates: true,
        icon: "map",
      })),
    ];
  }, [query, inside, anyLevel]);

  /*
   * Qué se está listando, para encabezar la lista.
   *
   * Son tres situaciones y el encabezado las distingue: la raíz muestra
   * departamentos, adentro de uno se muestran sus localidades, y buscando se
   * muestran localidades de todo el país. Sin esto, la lista de departamentos
   * y la de localidades se ven igual y no hay forma de saber si tocar una fila
   * va a elegirla o a meterse un nivel más adentro.
   *
   * "Localidad" y no "municipio": el municipio es una división política que no
   * cubre todo el país, y lo que la gente nombra —Minas, Las Piedras, Pando—
   * es la localidad. Es además el término del catálogo (BR-014).
   */
  const heading = query
    ? "Localidades"
    : inside
      ? `Localidades de ${getLocation(inside)?.name ?? ""}`
      : "Departamentos";

  function choose(locationId: string) {
    onChange(locationId);
    setOpen(false);
    setQuery("");
    setInside("");
  }

  /*
   * Se nombra lo elegido con su departamento detrás: hay localidades homónimas
   * y el nombre solo no alcanza para saber cuál quedó. Un departamento o el
   * país se nombran solos, que ya son únicos.
   */
  const label = selected
    ? selectedDepartment && selectedDepartment.id !== selected.id
      ? `${selected.name} · ${selectedDepartment.name}`
      : selected.name
    : (placeholder ?? "Elegí la localidad");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-input border bg-white px-3 text-left text-[16px] outline-none transition-colors sm:h-11 sm:text-[15px] ${
          invalid
            ? "border-[#D92D20]"
            : "border-line-strong focus:border-brand-800"
        } ${selected ? "text-ink" : "text-ink-faint"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            name="location_on"
            className={`flex-none text-[19px] ${
              selected ? "text-brand-800" : "text-ink-faint"
            }`}
          />
          <span className="truncate">{label}</span>
        </span>
        <Icon
          name="expand_more"
          className={`flex-none text-[20px] text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-input border border-line bg-white shadow-pop">
          <div className="border-b border-line-soft p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar localidad..."
              /* 16px en el teléfono: por debajo, iOS hace zoom al enfocar. */
              className="h-10 w-full rounded-[8px] border border-line-strong px-2.5 text-[16px] text-ink outline-none focus:border-brand-800 sm:text-[14px]"
            />
          </div>

          {/*
            Volver al listado de departamentos. Sólo estando dentro de uno y
            sin búsqueda: mientras se busca, la lista ya es de todo el país y
            no hay ningún nivel del que salir.
          */}
          {inside && !query ? (
            <button
              type="button"
              onClick={() => setInside("")}
              className="flex w-full items-center gap-1.5 border-b border-line-soft px-3 py-2.5 text-left text-[13.5px] font-semibold text-brand-800 hover:bg-surface-sunken"
            >
              <Icon name="arrow_back" className="text-[17px]" />
              {getLocation(inside)?.name ?? "Departamentos"}
            </button>
          ) : null}

          {/*
            Qué es esta lista. Va pegado arriba y no dentro del scroll: al
            bajar por 60 localidades el encabezado tiene que seguir diciendo
            de qué departamento son.
          */}
          <p className="border-b border-line-soft bg-surface-muted px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
            {heading}
          </p>

          <ul className="max-h-[260px] overflow-auto py-1">
            {rows.length === 0 ? (
              <li className="px-3 py-3 text-[13.5px] text-ink-soft">
                No hay localidades con ese nombre.
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    /*
                     * Una fila que navega entra un nivel; el resto elige. Es la
                     * misma fila para las dos cosas, así que la flecha de la
                     * derecha es lo que separa "entrar" de "quedarme con esto".
                     */
                    onClick={() =>
                      row.navigates ? setInside(row.id) : choose(row.id)
                    }
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[14px] hover:bg-surface-sunken ${
                      row.id === value
                        ? "font-semibold text-brand-800"
                        : "text-ink"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {/*
                        El icono separa los niveles de un vistazo: el globo es
                        el país, el mapa el departamento —que agrupa— y el pin
                        la localidad, que es un lugar. Es el mismo juego que ya
                        usa el panel de filtros para esta jerarquía.
                      */}
                      <Icon
                        name={row.icon}
                        className={`flex-none text-[18px] ${
                          row.icon === "location_on"
                            ? "text-ink-faint"
                            : "text-brand-800"
                        }`}
                      />
                      <span className="truncate">
                        {row.label}
                        {row.context ? (
                          <span className="ml-1.5 text-[12.5px] text-ink-soft">
                            {row.context}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {row.navigates ? (
                      <Icon
                        name="chevron_right"
                        className="flex-none text-[18px] text-ink-faint"
                      />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
