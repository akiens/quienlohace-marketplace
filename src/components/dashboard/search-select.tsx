"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/ui";
import { normalize } from "@/data/services";

/**
 * Una opción de la lista. `context` es la línea chica de abajo —el rubro al
 * que pertenece— y sirve para distinguir homónimos: hay "Clases de danza" en
 * Arte y en Fitness, y sin el rubro no se sabe cuál es cuál.
 */
export type SearchOption = {
  value: string;
  label: string;
  context?: string;
};

/**
 * Selector con búsqueda y selección múltiple.
 *
 * Reemplaza al par "select largo + botón Agregar". Con 633 servicios y 100
 * rubros, un `<select>` obliga a recorrer una lista enorme para encontrar algo
 * que ya se sabe cómo se llama; escribir dos letras lo resuelve. Sin texto
 * muestra la lista igual, así que quien no sabe qué buscar sigue pudiendo
 * mirar lo que hay.
 *
 * Lo elegido se rinde como `<input type="hidden">`, uno por valor: el
 * formulario se envía como siempre y el servidor recibe lo mismo que antes,
 * sin enterarse de que la forma de elegir cambió.
 *
 * Es un `combobox` de ARIA: el campo anuncia que despliega una lista, las
 * opciones se recorren con flechas y la activa viaja en `aria-activedescendant`
 * para que el lector de pantalla la lea sin mover el foco del campo.
 */
export function SearchSelect({
  label,
  options,
  selected,
  onSelect,
  onRemove,
  max,
  placeholder = "Buscá o elegí de la lista…",
  emptyLabel = "No hay resultados.",
  allowCustom = false,
  customHint,
  name,
  omitFromSubmit,
  error,
  disabled = false,
  onQueryChange,
  externallyFiltered = false,
}: {
  /** Para el lector de pantalla: el `<Field>` de afuera pone el visible. */
  label: string;
  options: SearchOption[];
  /** Lo ya elegido, en orden. */
  selected: SearchOption[];
  onSelect: (option: SearchOption) => void;
  onRemove: (value: string) => void;
  /** Tope del plan. Alcanzado, el campo deja de aceptar. */
  max?: number;
  placeholder?: string;
  emptyLabel?: string;
  /** Si se puede agregar algo que no está en la lista. */
  allowCustom?: boolean;
  customHint?: string;
  /** `name` de los inputs ocultos que viajan en el envío. */
  name: string;
  /**
   * Valores que se muestran como etiqueta pero no se envían con `name`.
   *
   * Para cuando uno de los elegidos viaja por su cuenta en otro campo: el
   * rubro principal es `subcategoryId` y los demás `subcategoryIds`, así que
   * mandarlo en los dos lo contaría dos veces contra el tope del plan.
   */
  omitFromSubmit?: string[];
  error?: string;
  disabled?: boolean;
  /**
   * Avisa lo tipeado. Para cuando quien usa el componente arma las opciones
   * por su cuenta —el catálogo de servicios se filtra afuera, porque son 633
   * y el orden depende del rubro ya elegido—.
   */
  onQueryChange?: (query: string) => void;
  /**
   * Que el componente no filtre: las opciones ya vienen filtradas por lo
   * tipeado. Lo usa el catálogo de servicios, que se busca afuera con su
   * propio orden de relevancia sobre las 633 entradas y no sobre las pocas
   * que llegan acá.
   */
  externallyFiltered?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /*
   * La fila resaltada se reinicia al cambiar lo tipeado. Se hace comparando
   * durante el render y no desde un efecto: un efecto pintaría primero la
   * lista nueva con la fila vieja resaltada, y recién en el render siguiente
   * la corregiría.
   */
  const [queryOfActive, setQueryOfActive] = useState("");
  if (queryOfActive !== query) {
    setQueryOfActive(query);
    setActive(0);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const full = max !== undefined && selected.length >= max;
  const locked = disabled || full;

  const trimmed = query.trim();

  /*
   * Lo ya elegido no se vuelve a ofrecer: agregarlo de nuevo no haría nada y
   * ocupa un lugar en una lista donde el espacio es lo que escasea.
   */
  const taken = useMemo(
    () => new Set(selected.map((option) => option.value)),
    [selected],
  );
  /*
   * Las opciones que se muestran: sin las ya elegidas y, si el filtrado es de
   * acá, sin las que no coinciden con lo tipeado.
   *
   * Se busca en la etiqueta y en el contexto —el rubro—, sin tildes ni
   * mayúsculas: "peluqueria" tiene que encontrar "Peluquería", y escribir un
   * rubro tiene que traer lo que cuelga de él.
   */
  const visible = useMemo(() => {
    const available = options.filter((option) => !taken.has(option.value));
    if (externallyFiltered) return available;

    const needle = normalize(trimmed);
    if (!needle) return available;

    return available.filter((option) => {
      const label = normalize(option.label);
      const context = normalize(option.context ?? "");
      return label.includes(needle) || context.includes(needle);
    });
  }, [options, taken, trimmed, externallyFiltered]);

  /*
   * Agregar algo que no está en el catálogo. Sólo si lo tipeado no es
   * exactamente una opción que ya se ofrece: si no, habría dos filas que
   * hacen lo mismo y la de abajo parecería otra cosa.
   */
  const canCreate =
    allowCustom &&
    trimmed.length > 0 &&
    !visible.some(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    ) &&
    !selected.some(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );

  // La fila de "crear" va al final: primero lo que el catálogo ya tiene.
  const rows: Array<SearchOption | { create: true }> = [
    ...visible,
    ...(canCreate ? [{ create: true as const }] : []),
  ];

  /* Clic afuera cierra: es lo que se espera de algo que se desplegó. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = useCallback(
    (row: SearchOption | { create: true }) => {
      if ("create" in row) {
        onSelect({ value: trimmed, label: trimmed });
      } else {
        onSelect(row);
      }
      setQuery("");
      onQueryChange?.("");
      setActive(0);
    },
    [onSelect, onQueryChange, trimmed],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + delta + rows.length) % rows.length);
      return;
    }

    if (event.key === "Enter") {
      // Siempre: sin esto Enter enviaría el formulario entero desde acá.
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const row = rows[active];
      if (row) choose(row);
      // El foco ya está en el campo: se sigue agregando sin tocar nada.
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    // Backspace con el campo vacío saca el último, como en los campos de
    // etiquetas: es más rápido que apuntarle a la cruz.
    if (event.key === "Backspace" && query === "" && selected.length > 0) {
      const last = selected[selected.length - 1];
      if (last) onRemove(last.value);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2.5">
      {/*
        Lo elegido viaja en inputs ocultos, uno por valor: para el servidor es
        el mismo campo repetido de siempre.
      */}
      {selected
        .filter((option) => !omitFromSubmit?.includes(option.value))
        .map((option) => (
          <input
            key={option.value}
            type="hidden"
            name={name}
            value={option.value}
          />
        ))}

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li key={option.value}>
              <span className="flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-3 pr-1.5 text-[13px] font-semibold text-brand-800">
                {option.label}
                <button
                  type="button"
                  onClick={() => onRemove(option.value)}
                  aria-label={`Quitar ${option.label}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-brand-800 transition-colors hover:bg-brand-800 hover:text-white"
                >
                  <Icon name="close" className="text-[14px]" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {locked ? null : (
        <div className="relative">
          <div
            className={`flex h-11 items-center gap-2 rounded-input border bg-white px-3 transition-colors focus-within:border-brand-800 ${
              error ? "border-[#B42318]" : "border-line-strong"
            }`}
          >
            <Icon name="search" className="text-[18px] text-ink-faint" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={label}
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && rows[active] ? `${listId}-${active}` : undefined
              }
              autoComplete="off"
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                onQueryChange?.(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={open ? "Cerrar lista" : "Abrir lista"}
              onClick={() => {
                setOpen((current) => !current);
                inputRef.current?.focus();
              }}
              className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-soft hover:text-ink"
            >
              <Icon
                name={open ? "expand_less" : "expand_more"}
                className="text-[20px]"
              />
            </button>
          </div>

          {open ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-card border border-line-strong bg-white py-1 shadow-mega"
            >
              {rows.length === 0 ? (
                <li className="px-3 py-2.5 text-[14px] text-ink-soft">
                  {emptyLabel}
                </li>
              ) : (
                rows.map((row, index) => {
                  const isActive = index === active;
                  const creating = "create" in row;

                  return (
                    <li
                      /*
                       * La posición y no el valor: dos servicios distintos
                       * pueden llamarse igual en rubros distintos ("Clases de
                       * danza" está en Música y en Deportes), y ahí el valor
                       * repetido rompía la lista.
                       */
                      key={creating ? "__create" : `${row.value}-${index}`}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onPointerDown={(event) => {
                        /*
                         * `pointerdown` y no `click`: el clic llega después
                         * del blur del campo, y para entonces la lista ya se
                         * cerró. `preventDefault` evita ese blur, así que el
                         * foco se queda donde estaba y se puede seguir
                         * escribiendo para agregar el siguiente.
                         */
                        event.preventDefault();
                        choose(row);
                      }}
                      onMouseEnter={() => setActive(index)}
                      className={`cursor-pointer px-3 py-2 ${
                        isActive ? "bg-brand-100" : ""
                      }`}
                    >
                      {creating ? (
                        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-brand-800">
                          <Icon name="add" className="text-[16px]" />
                          Agregar «{trimmed}»
                        </span>
                      ) : (
                        <>
                          <span className="block text-[14px] text-ink">
                            {row.label}
                          </span>
                          {row.context ? (
                            <span className="block text-[12.5px] text-ink-soft">
                              {row.context}
                            </span>
                          ) : null}
                        </>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
      )}

      {customHint && allowCustom && !locked ? (
        <p className="text-[12.5px] text-ink-soft">{customHint}</p>
      ) : null}
    </div>
  );
}
