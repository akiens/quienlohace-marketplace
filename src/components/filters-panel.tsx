"use client";

import { useEffect } from "react";

import { CATEGORIES } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import { countActiveFilters } from "@/lib/search";
import {
  EMPTY_FILTERS,
  MAX_SUBCATEGORIES,
  type PaymentMethod,
  type SearchFilters,
} from "@/types";
import { Icon } from "@/components/ui";

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Cualquiera", value: null },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

const PAYMENT_OPTIONS: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Otros",
];

/**
 * Panel de filtros: drawer lateral en escritorio, bottom sheet en mobile.
 * Los cambios se aplican en vivo; "Aplicar" sólo cierra el panel.
 */
export function FiltersPanel({
  open,
  filters,
  resultCount,
  onChange,
  onClose,
}: {
  open: boolean;
  filters: SearchFilters;
  resultCount: number;
  onChange: (filters: SearchFilters) => void;
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

  function toggleSubcategory(id: string) {
    const selected = filters.subcategoryIds;
    if (selected.includes(id)) {
      onChange({ ...filters, subcategoryIds: selected.filter((x) => x !== id) });
      return;
    }
    if (selected.length >= MAX_SUBCATEGORIES) return;
    onChange({ ...filters, subcategoryIds: [...selected, id] });
  }

  function togglePayment(method: PaymentMethod) {
    const selected = filters.paymentMethods;
    onChange({
      ...filters,
      paymentMethods: selected.includes(method)
        ? selected.filter((x) => x !== method)
        : [...selected, method],
    });
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
                Estamos usando tu ubicación aproximada. Desactivá esta opción para
                elegir zonas manualmente.
              </p>
            ) : filters.locationIds.length > 0 ? (
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
                          locationIds: filters.locationIds.filter((x) => x !== id),
                        })
                      }
                    >
                      <Icon name="close" className="text-[15px] text-[#5B6B87]" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-ink-soft">
                Elegí zonas desde el buscador para acotar los resultados.
              </p>
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

          <Group title={`Servicios · máximo ${MAX_SUBCATEGORIES}`}>
            <div className="flex flex-col gap-2">
              {CATEGORIES.slice(0, 6).map((category) => (
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
                    {category.subcategories.map((sub) => {
                      const selected = filters.subcategoryIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[13.5px] text-ink-muted hover:bg-surface-sunken"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSubcategory(sub.id)}
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
          </Group>

          <Group title="Formas de pago">
            <div className="flex flex-col gap-0.5">
              {PAYMENT_OPTIONS.map((method) => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[7px] p-2 text-[14px] text-ink-muted hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={filters.paymentMethods.includes(method)}
                    onChange={() => togglePayment(method)}
                    className="h-4 w-4 accent-brand-800"
                  />
                  {method}
                </label>
              ))}
            </div>
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
            onClick={onClose}
            className="h-11 flex-1 rounded-input bg-brand-800 px-5 text-[15px] font-bold text-white hover:bg-brand-900 sm:flex-none"
          >
            Ver {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
          </button>
        </footer>
      </div>
    </>
  );
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
