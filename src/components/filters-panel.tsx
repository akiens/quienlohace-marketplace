"use client";

import { useEffect } from "react";

import { SERVICE_SECTORS, listSpecialties } from "@/data/taxonomy";
import {
  COUNTRY_ID,
  COUNTRY_LABEL,
  listDepartments,
  listLocalities,
  locationLabelById,
} from "@/data/locations";
import { countActiveFilters } from "@/lib/search";
import {
  EMPTY_FILTERS,
  PAYMENT_METHOD_LABELS,
  RESULT_KIND_LABELS,
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type ResultKind,
  type SearchFilters,
  type ServiceModeCode,
} from "@/types";
import { Icon } from "@/components/ui";

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Cualquiera", value: null },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

const PAYMENT_OPTIONS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
  "other",
];

const RESULT_KIND_OPTIONS: { kind: ResultKind; icon: string }[] = [
  { kind: "individual", icon: "person" },
  { kind: "business", icon: "apartment" },
  {
    kind: "service",
    icon: "sell",
  },
];

const SERVICE_MODE_OPTIONS: { mode: ServiceModeCode; icon: string }[] = [
  { mode: "at_customer", icon: "home_work" },
  { mode: "at_business", icon: "storefront" },
  { mode: "remote", icon: "videocam" },
];

/**
 * Panel de filtros: drawer lateral en escritorio, bottom sheet en mobile.
 *
 * En la página de resultados los cambios se aplican en vivo y el botón del pie
 * sólo cierra, diciendo cuántos resultados quedaron. En la portada todavía no
 * hay búsqueda hecha —ni cuenta que mostrar—, así que ese botón es el que la
 * lanza: `onSubmit` en lugar de `resultCount`.
 */
export function FiltersPanel({
  open,
  filters,
  resultCount,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  filters: SearchFilters;
  /**
   * Coincidencias de la búsqueda vigente. Se omite donde no hay ninguna
   * hecha: mostrar "Ver 0 resultados" antes de buscar sería mentira.
   */
  resultCount?: number;
  onChange: (filters: SearchFilters) => void;
  /** Lanza la búsqueda desde el pie del panel. Sin él, el botón sólo cierra. */
  onSubmit?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const activeCount = countActiveFilters(filters);

  /*
   * "Todo el país" elegido. Es un id de ubicación más —no un booleano aparte—,
   * así que la búsqueda no necesita saber nada de este caso: llega como una
   * zona y `coveringLocationIds` la expande como a cualquier otra (TR-019).
   */
  const countrywide = filters.locationIds.includes(COUNTRY_ID);

  /**
   * Suma o quita un valor de una lista de filtros.
   *
   * Todas las listas del panel funcionan igual —vacía es "todos", y elegir
   * varios es "cualquiera de estos"—, así que el alta y la baja son una sola
   * función y no cuatro copias con el nombre cambiado. Ya no hay tope: el
   * filtro dejó de limitar cuántas zonas o especialidades se pueden pedir.
   */
  function toggleIn<K extends "resultKinds" | "locationIds" | "specialtyIds" | "paymentMethods" | "serviceModes">(
    key: K,
    value: SearchFilters[K][number],
  ) {
    const selected = filters[key] as SearchFilters[K][number][];
    const next = selected.includes(value)
      ? selected.filter((x) => x !== value)
      : [...selected, value];
    onChange({ ...filters, [key]: next });
  }

  function toggleLocation(id: string) {
    toggleIn("locationIds", id);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros de búsqueda"
        className="fixed inset-x-0 bottom-0 z-[81] flex max-h-[86vh] flex-col rounded-t-[18px] bg-white sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(420px,92vw)] sm:rounded-none"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-ink">Filtros</h2>
            {activeCount > 0 ? (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-ink">
                {activeCount}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F2F4F7]"
          >
            <Icon name="close" className="text-[20px] text-ink" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4">
          {/*
            Qué se busca. Va primero porque decide sobre qué se aplica todo lo
            de abajo: perfiles de una persona, de una empresa, o cartas de
            servicio cuando existan.
          */}
          <Group title="Qué estás buscando">
            <AllToggle
              label="Todos los resultados"
              checked={filters.resultKinds.length === 0}
              onChange={() => onChange({ ...filters, resultKinds: [] })}
            />
            <DimmedWhenAll dimmed={filters.resultKinds.length === 0}>
              <div className="flex flex-col gap-0.5">
                {RESULT_KIND_OPTIONS.map(({ kind, icon }) => (
                  <label
                    key={kind}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[14px] text-ink-muted hover:bg-surface-sunken"
                  >
                    <input
                      type="checkbox"
                      checked={filters.resultKinds.includes(kind)}
                      onChange={() => toggleIn("resultKinds", kind)}
                      className="h-4 w-4 accent-brand-800"
                    />
                    <Icon name={icon} className="text-[18px] text-brand-800" />
                    {RESULT_KIND_LABELS[kind]}
                  </label>
                ))}
              </div>
            </DimmedWhenAll>
          </Group>

          {/*
            La ubicación se elige acá: antes este grupo sólo mostraba lo ya
            seleccionado y remitía al buscador —"Elegí zonas desde el
            buscador"—, pero ese selector se mudó a este panel y el texto
            mandaba a un lugar que ya no existe.

            Departamento y dentro sus localidades, que es como está armado el
            catálogo geográfico (BR-014).
          */}
          <Group title="Ubicación">
            <label className="flex items-center gap-3 rounded-input border border-line bg-white p-3">
              <input
                type="checkbox"
                checked={filters.useMyLocation}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    useMyLocation: event.target.checked,
                    // Usar la ubicación actual deshabilita la selección manual.
                    locationIds: event.target.checked ? [] : filters.locationIds,
                  })
                }
                className="h-4 w-4 accent-brand-800"
              />
              <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Icon name="my_location" className="text-[18px] text-brand-800" />
                Usar mi ubicación
              </span>
            </label>

            {filters.useMyLocation ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Estamos usando tu ubicación aproximada. Desactivá esta opción
                para elegir zonas manualmente.
              </p>
            ) : (
              <>
                {filters.locationIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filters.locationIds.map((id) => (
                      <span
                        key={id}
                        className="flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold text-brand-800"
                      >
                        {locationLabelById(id)}
                        <button
                          type="button"
                          aria-label={`Quitar ${locationLabelById(id)}`}
                          onClick={() =>
                            onChange({
                              ...filters,
                              locationIds: filters.locationIds.filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                        >
                          <Icon
                            name="close"
                            className="text-[15px] text-[#5B6B87]"
                          />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 flex flex-col gap-2">
                  {/*
                    Todo el país es una opción explícita y no el vacío: quien
                    trabaja a distancia atiende en cualquier lado, y eso se
                    elige, no se deduce de no haber elegido nada.
                  */}
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-line p-2.5 text-[14px] font-semibold text-ink hover:bg-surface-sunken">
                    <input
                      type="checkbox"
                      checked={countrywide}
                      onChange={() =>
                        onChange({
                          ...filters,
                          /*
                           * Elegir todo el país reemplaza lo que hubiera
                           * elegido antes: quedarse con Montevideo debajo de
                           * "todo el país" no acota nada y al destildarlo
                           * reaparecería una selección que ya no se ve.
                           */
                          locationIds: countrywide ? [] : [COUNTRY_ID],
                        })
                      }
                      className="h-4 w-4 accent-brand-800"
                    />
                    <Icon name="public" className="text-[18px] text-brand-800" />
                    {COUNTRY_LABEL} · todo el país
                  </label>

                  {/*
                    Con todo el país elegido los departamentos se esconden, no
                    se deshabilitan: es la excepción a la regla del resto del
                    panel, y la pidió el propio criterio —"todo el país" ya
                    incluye cada localidad, así que una lista de zonas debajo
                    no afina nada, sólo invita a una contradicción—.
                  */}
                  {countrywide
                    ? null
                    : listDepartments().map((department) => (
                    <details
                      key={department.id}
                      className="rounded-input border border-line"
                    >
                      <summary className="flex cursor-pointer items-center gap-2.5 p-2.5 text-[14px] font-semibold text-ink">
                        <Icon
                          name="location_on"
                          className="text-[18px] text-brand-800"
                        />
                        {department.name}
                      </summary>
                      <div className="flex flex-col gap-0.5 border-t border-line-soft p-1.5">
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[13.5px] font-semibold text-ink-muted hover:bg-surface-sunken">
                          <input
                            type="checkbox"
                            checked={filters.locationIds.includes(department.id)}
                            onChange={() => toggleLocation(department.id)}
                            className="h-4 w-4 accent-brand-800"
                          />
                          Todo {department.name}
                        </label>

                        {listLocalities(department.id).map((locality) => (
                          <label
                            key={locality.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[13.5px] text-ink-muted hover:bg-surface-sunken"
                          >
                            <input
                              type="checkbox"
                              checked={filters.locationIds.includes(locality.id)}
                              onChange={() => toggleLocation(locality.id)}
                              className="h-4 w-4 accent-brand-800"
                            />
                            {locality.name}
                          </label>
                        ))}
                      </div>
                    </details>
                      ))}
                </div>
              </>
            )}
          </Group>

          <Group title="Calificación">
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map((option) => {
                const selected = filters.minRating === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onChange({ ...filters, minRating: option.value })}
                    className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
                      selected
                        ? "border-brand-800 bg-brand-100 text-brand-800"
                        : "border-line-strong bg-white text-ink-muted hover:bg-surface-muted"
                    }`}
                  >
                    {option.value !== null ? (
                      <Icon name="star" filled className="text-[15px] text-accent" />
                    ) : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Group>

          {/*
            "Rubro" y "Especialidad" son los nombres del dominio (BR-010) y los
            que usa el resto del sitio: el asistente, el perfil y el menú. Este
            grupo decía "Servicios", que acá es otra cosa —lo que el proveedor
            ofrece dentro de una especialidad— y confundía dos niveles.

            Se listan todos los rubros y no los primeros seis: recortar la
            lista escondía catorce sin decirlo, y no había forma de llegar a
            ellos desde ningún otro lado.
          */}
          <Group title="Rubros y especialidades">
            <AllToggle
              label="Todos los rubros y especialidades"
              checked={filters.specialtyIds.length === 0}
              onChange={() => onChange({ ...filters, specialtyIds: [] })}
            />
            <DimmedWhenAll dimmed={filters.specialtyIds.length === 0}>
            <div className="flex flex-col gap-2">
              {SERVICE_SECTORS.map((category) => (
                <details
                  key={category.id}
                  className="rounded-input border border-line"
                >
                  <summary className="flex cursor-pointer items-center gap-2.5 p-2.5 text-[14px] font-semibold text-ink">
                    <Icon
                      name={category.icon}
                      className="text-[18px] text-brand-800"
                    />
                    {category.short}
                  </summary>
                  <div className="flex flex-col gap-0.5 border-t border-line-soft p-1.5">
                    {listSpecialties(category.id).map((sub) => {
                      const selected = filters.specialtyIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[13.5px] text-ink-muted hover:bg-surface-sunken"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleIn("specialtyIds", sub.id)}
                            className="h-4 w-4 accent-brand-800"
                          />
                          {sub.name}
                        </label>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
            </DimmedWhenAll>
          </Group>

          <Group title="Formas de pago">
            <AllToggle
              label="Todas las formas de pago"
              checked={filters.paymentMethods.length === 0}
              onChange={() => onChange({ ...filters, paymentMethods: [] })}
            />
            <DimmedWhenAll dimmed={filters.paymentMethods.length === 0}>
              <div className="flex flex-col gap-0.5">
                {PAYMENT_OPTIONS.map((method) => (
                  <label
                    key={method}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[14px] text-ink-muted hover:bg-surface-sunken"
                  >
                    <input
                      type="checkbox"
                      checked={filters.paymentMethods.includes(method)}
                      onChange={() => toggleIn("paymentMethods", method)}
                      className="h-4 w-4 accent-brand-800"
                    />
                    {PAYMENT_METHOD_LABELS[method]}
                  </label>
                ))}
              </div>
            </DimmedWhenAll>
          </Group>

          {/* BR-017: cómo se presta el servicio. Elegir varias es "cualquiera". */}
          <Group title="Modalidad">
            <AllToggle
              label="Todas las modalidades"
              checked={filters.serviceModes.length === 0}
              onChange={() => onChange({ ...filters, serviceModes: [] })}
            />
            <DimmedWhenAll dimmed={filters.serviceModes.length === 0}>
              <div className="flex flex-col gap-0.5">
                {SERVICE_MODE_OPTIONS.map(({ mode, icon }) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[14px] text-ink-muted hover:bg-surface-sunken"
                  >
                    <input
                      type="checkbox"
                      checked={filters.serviceModes.includes(mode)}
                      onChange={() => toggleIn("serviceModes", mode)}
                      className="h-4 w-4 accent-brand-800"
                    />
                    <Icon name={icon} className="text-[18px] text-brand-800" />
                    {SERVICE_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </DimmedWhenAll>
          </Group>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
            className="text-[13.5px] font-semibold text-ink-soft hover:text-ink"
          >
            Limpiar todo
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSubmit?.();
            }}
            className="h-11 flex-1 rounded-input bg-brand-800 px-5 text-[15px] font-bold text-white hover:bg-brand-900 sm:flex-none"
          >
            {resultCount === undefined
              ? "Buscar"
              : `Ver ${resultCount} ${resultCount === 1 ? "resultado" : "resultados"}`}
          </button>
        </footer>
      </div>
    </>
  );
}

/**
 * La casilla "todos" que encabeza un grupo.
 *
 * Marcada significa "sin filtrar por esto", que es la lista vacía: destildar
 * un valor cualquiera la desmarca sola. Volver a marcarla limpia el grupo.
 *
 * No esconde las opciones que hay debajo, las deshabilita: si desaparecieran,
 * quien mira el panel no tendría cómo saber que ese criterio se puede afinar
 * —y "todos" dejaría de parecer una elección para parecer el único estado
 * posible—.
 */
function AllToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  /*
   * "Todos" es un estado derivado: vale cuando no hay nada elegido. Por eso
   * sólo se puede marcar, nunca desmarcar —destildarlo no significa nada,
   * porque no existe una selección anterior a la que volver—. Se apaga cuando
   * ya está marcado, y quien quiera acotar toca una opción de la lista, que
   * es lo que lo desmarca solo.
   *
   * Antes esto era un checkbox común: al estar marcado el clic reescribía la
   * lista vacía sobre sí misma, no cambiaba nada, y como el grupo de abajo
   * estaba deshabilitado no había forma de salir del "todos".
   */
  return (
    <label
      className={`mb-2 flex items-center gap-2.5 rounded-input border border-line bg-surface-muted p-2.5 text-[14px] font-semibold text-ink ${
        checked ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={checked}
        onChange={onChange}
        className="h-4 w-4 accent-brand-800"
      />
      {label}
    </label>
  );
}

/**
 * El cuerpo de un grupo mientras su "todos" está marcado.
 *
 * Baja el contraste para que se vea que ese criterio no está acotando nada,
 * pero **no** bloquea: tocar cualquier opción tiene que poder sacar al grupo
 * del "todos", y es la única manera de hacerlo.
 *
 * Antes esto ponía `inert` y `pointer-events-none`. Con el "todos" marcado
 * —que es como abre el panel— el grupo entero quedaba muerto: no se podía
 * elegir nada, y destildar "todos" tampoco servía porque no cambiaba el
 * estado. El grupo era inalcanzable.
 */
function DimmedWhenAll({
  dimmed,
  children,
}: {
  dimmed: boolean;
  children: React.ReactNode;
}) {
  return <div className={dimmed ? "opacity-60" : undefined}>{children}</div>;
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}
