"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  SERVICE_SECTORS,
  getSpecialty,
  listSpecialties,
} from "@/data/taxonomy";
import {
  COUNTRY_ID,
  COUNTRY_LABEL,
  listDepartments,
  listLocalities,
  locationLabelById,
} from "@/data/locations";
import { searchHref } from "@/lib/query";
import { countActiveFilters } from "@/lib/search";
import { MAX_LOCATIONS, MAX_SPECIALTIES, type SearchFilters } from "@/types";
import { Icon, SECONDARY_SURFACE } from "@/components/ui";

const QUICK_SEARCHES = [
  "Electricista",
  "Plomero",
  "Limpieza",
  "Fletes",
  "Peluquería",
];

type SearchPanelProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  variant?: "hero" | "compact";
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
  onChange,
  variant = "hero",
  title = "¿Qué servicio necesitás?",
  subtitle = "Encontrá profesionales y empresas verificadas en todo Uruguay.",
  onOpenFilters,
}: SearchPanelProps) {
  const router = useRouter();
  const [openPopover, setOpenPopover] = useState<"location" | "category" | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const isHero = variant === "hero";
  const activeFilterCount = countActiveFilters(filters);

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
    router.push(searchHref(filters));
  }

  const locationLabel =
    filters.locationIds.length === 0
      ? "Todo el país"
      : filters.locationIds.length === 1
        ? locationLabelById(filters.locationIds[0]!)
        : `${locationLabelById(filters.locationIds[0]!)} +${filters.locationIds.length - 1}`;

  const categoryLabel = (() => {
    if (filters.specialtyIds.length === 0) return "Todos los rubros";
    const name = getSpecialty(filters.specialtyIds[0]!)?.name ?? "Especialidad";
    return filters.specialtyIds.length === 1
      ? name
      : `${name} +${filters.specialtyIds.length - 1}`;
  })();

  return (
    <section className="relative overflow-visible bg-brand-gradient">
      <div className="pointer-events-none absolute inset-0 bg-hatch" />

      <div
        ref={panelRef}
        className={`shell relative ${isHero ? "py-5 lg:py-6" : "py-2"}`}
      >
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
          className="flex flex-col gap-2 rounded-card bg-white p-2.5 shadow-[0_12px_30px_-12px_rgba(10,20,40,.45)] lg:flex-row"
          role="search"
        >
          <div className="flex h-12 flex-1 items-center gap-2.5 rounded-input border border-[#EAECF0] bg-surface-muted px-3">
            <Icon name="search" className="text-[21px] text-ink-soft" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) =>
                onChange({ ...filters, query: event.target.value })
              }
              placeholder="Buscar profesionales, empresas o servicios..."
              aria-label="Buscar profesionales, empresas o servicios"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft"
            />
          </div>

          {/* En móvil cada control ocupa el ancho completo: lado a lado las
              etiquetas largas ("Todas las categorías") se recortan y la fila
              queda despareja respecto del buscador. */}
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-none lg:basis-[400px]">
            <PopoverButton
              icon="location_on"
              label={locationLabel}
              active={filters.locationIds.length > 0}
              open={openPopover === "location"}
              onClick={() =>
                setOpenPopover(openPopover === "location" ? null : "location")
              }
            />
            <PopoverButton
              icon={filters.specialtyIds.length ? "check_circle" : "category"}
              label={categoryLabel}
              active={filters.specialtyIds.length > 0}
              open={openPopover === "category"}
              onClick={() =>
                setOpenPopover(openPopover === "category" ? null : "category")
              }
            />
          </div>

          <div className="flex gap-2">
            {onOpenFilters ? (
              <button
                type="button"
                onClick={onOpenFilters}
                className={`flex h-12 flex-none items-center justify-center gap-2 rounded-input px-3.5 text-[14.5px] font-semibold ${SECONDARY_SURFACE}`}
              >
                <Icon name="tune" className="text-[20px] text-brand-800" />
                Filtros
                {activeFilterCount > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-ink">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}

            <button
              type="submit"
              className="h-12 flex-1 whitespace-nowrap rounded-input bg-brand-800 px-6 text-[15px] font-bold text-white transition-colors hover:bg-brand-950"
            >
              Buscar
            </button>
          </div>
        </form>

        {openPopover === "location" ? (
          <LocationPopover
            filters={filters}
            onChange={onChange}
            onClose={() => setOpenPopover(null)}
          />
        ) : null}

        {openPopover === "category" ? (
          <CategoryPopover
            filters={filters}
            onChange={onChange}
            onClose={() => setOpenPopover(null)}
          />
        ) : null}

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
                  const next = { ...filters, query: term };
                  onChange(next);
                  router.push(searchHref(next));
                }}
                className="rounded-full border border-white/20 bg-white/[.13] px-2.5 py-1 text-[13px] font-semibold text-white transition-colors hover:bg-white/25"
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PopoverButton({
  icon,
  label,
  active,
  open,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`flex h-12 min-w-0 flex-1 items-center gap-1.5 rounded-input border bg-white px-3 ${
        open ? "border-brand-800" : "border-line-strong"
      }`}
    >
      <Icon name={icon} className="text-[20px] text-brand-800" />
      <span
        className={`truncate text-[14.5px] font-semibold ${
          active ? "text-ink" : "text-ink-soft"
        }`}
      >
        {label}
      </span>
      <Icon name="expand_more" className="ml-auto text-[18px] text-ink-faint" />
    </button>
  );
}

function PopoverShell({
  title,
  children,
  onClear,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-5 z-40 mt-2 overflow-hidden rounded-card border border-line bg-white shadow-pop sm:inset-x-6">
      <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-3">
        <p className="text-[13.5px] font-bold text-ink">{title}</p>
      </div>
      {children}
      <div className="flex items-center justify-between border-t border-line-soft px-3.5 py-2.5">
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] font-semibold text-ink-soft hover:text-ink"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-[34px] rounded-lg bg-brand-800 px-4 text-[13.5px] font-semibold text-white hover:bg-brand-900"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function LocationPopover({
  filters,
  onChange,
  onClose,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClose: () => void;
}) {
  const departments = listDepartments();
  const [department, setDepartment] = useState(departments[0]?.id ?? "");
  const localities = listLocalities(department);

  function toggle(id: string) {
    const selected = filters.locationIds;
    if (selected.includes(id)) {
      onChange({ ...filters, locationIds: selected.filter((x) => x !== id) });
      return;
    }
    if (selected.length >= MAX_LOCATIONS) return;
    onChange({ ...filters, locationIds: [...selected, id] });
  }

  return (
    <PopoverShell
      title={`Ubicación · máximo ${MAX_LOCATIONS}`}
      onClear={() =>
        onChange({ ...filters, locationIds: [], useMyLocation: false })
      }
      onClose={onClose}
    >
      {filters.locationIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line-soft bg-[#FBFCFD] px-3.5 py-2.5">
          {filters.locationIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold text-brand-800"
            >
              {locationLabelById(id)}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Quitar ${locationLabelById(id)}`}
              >
                <Icon name="close" className="text-[15px] text-[#5B6B87]" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/*
        Dos columnas y no tres: el catálogo llega hasta la localidad, que es su
        nivel más preciso (BR-014). Los barrios salieron del modelo.
      */}
      <div className="grid max-h-[300px] grid-cols-1 sm:grid-cols-2">
        <ColumnList label="Departamento">
          {/*
            Buscar en todo el país es una opción explícita: encuentra a quien
            tiene cobertura nacional y a cualquiera más abajo (TR-019).
          */}
          <button
            type="button"
            onClick={() => toggle(COUNTRY_ID)}
            className={`flex w-full items-center gap-2 rounded-[7px] p-2 text-left text-[13.5px] text-[#344054] hover:bg-surface-sunken ${
              filters.locationIds.includes(COUNTRY_ID)
                ? "font-bold"
                : "font-medium"
            }`}
          >
            <Checkbox checked={filters.locationIds.includes(COUNTRY_ID)} />
            Todo {COUNTRY_LABEL}
          </button>

          {departments.map((item) => {
            const selected = filters.locationIds.includes(item.id);
            return (
              <div key={item.id} className="flex items-center gap-1">
                {/*
                  El departamento se puede elegir entero: quien trabaja en todo
                  Canelones no tiene por qué nombrar sus localidades (BR-016).
                */}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`flex flex-1 items-center gap-2 rounded-[7px] p-2 text-left text-[13.5px] text-[#344054] hover:bg-surface-sunken ${
                    selected ? "font-bold" : "font-medium"
                  }`}
                >
                  <Checkbox checked={selected} />
                  {item.name}
                </button>
                <button
                  type="button"
                  onClick={() => setDepartment(item.id)}
                  aria-label={`Ver localidades de ${item.name}`}
                  className={`rounded p-1 hover:bg-surface-sunken ${
                    item.id === department ? "bg-surface-sunken" : ""
                  }`}
                >
                  <Icon
                    name="chevron_right"
                    className="text-[17px] text-ink-faint"
                  />
                </button>
              </div>
            );
          })}
        </ColumnList>

        <ColumnList label="Ciudad / Localidad">
          {localities.length === 0 ? (
            <p className="p-2 text-[13px] leading-relaxed text-ink-faint">
              Elegí un departamento para ver sus localidades.
            </p>
          ) : (
            localities.map((item) => {
              const selected = filters.locationIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-center gap-2 rounded-[7px] p-2 text-left text-[13.5px] text-[#344054] hover:bg-surface-sunken ${
                    selected ? "font-bold" : "font-medium"
                  }`}
                >
                  <Checkbox checked={selected} />
                  {item.name}
                </button>
              );
            })
          )}
        </ColumnList>
      </div>
    </PopoverShell>
  );
}

function CategoryPopover({
  filters,
  onChange,
  onClose,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClose: () => void;
}) {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category = SERVICE_SECTORS[categoryIndex] ?? SERVICE_SECTORS[0]!;

  function toggle(id: string) {
    const selected = filters.specialtyIds;
    if (selected.includes(id)) {
      onChange({ ...filters, specialtyIds: selected.filter((x) => x !== id) });
      return;
    }
    if (selected.length >= MAX_SPECIALTIES) return;
    onChange({ ...filters, specialtyIds: [...selected, id] });
  }

  return (
    <PopoverShell
      title={`Categoría · máximo ${MAX_SPECIALTIES}`}
      onClear={() => onChange({ ...filters, specialtyIds: [] })}
      onClose={onClose}
    >
      <div className="grid max-h-[320px] grid-cols-1 sm:grid-cols-2">
        <ColumnList>
          {SERVICE_SECTORS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategoryIndex(index)}
              className={`flex w-full items-center gap-2.5 rounded-[7px] p-2 text-left hover:bg-surface-sunken ${
                index === categoryIndex ? "bg-surface-sunken" : ""
              }`}
            >
              <Icon name={item.icon} className="text-[19px] text-brand-800" />
              <span
                className={`text-[13.5px] leading-tight text-[#344054] ${
                  index === categoryIndex ? "font-bold" : "font-medium"
                }`}
              >
                {item.short}
              </span>
              <Icon
                name="chevron_right"
                className="ml-auto text-[17px] text-ink-faint"
              />
            </button>
          ))}
        </ColumnList>

        <ColumnList>
          {listSpecialties(category.id).map((sub) => {
            const selected = filters.specialtyIds.includes(sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => toggle(sub.id)}
                className={`flex w-full items-center gap-2 rounded-[7px] p-2 text-left text-[13.5px] text-[#344054] hover:bg-surface-sunken ${
                  selected ? "bg-surface-muted" : ""
                }`}
              >
                <Checkbox checked={selected} />
                {sub.name}
              </button>
            );
          })}
        </ColumnList>
      </div>
    </PopoverShell>
  );
}

function ColumnList({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-auto border-line-soft p-1.5 sm:border-r sm:last:border-r-0">
      {label ? (
        <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.5px] text-ink-faint">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${
        checked ? "border-brand-800 bg-brand-800" : "border-[#CDD4E0] bg-white"
      }`}
    >
      {checked ? <Icon name="check" className="text-[13px] text-white" /> : null}
    </span>
  );
}
