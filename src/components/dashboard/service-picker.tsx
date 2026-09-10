"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui";
import { getSpecialty } from "@/data/taxonomy";
import type { ProfileService } from "@/types";

export function ServicePicker({
  services,
  value,
  onChange,
  onBlur,
  error,
  errorId,
}: {
  services: ProfileService[];
  value: string;
  onChange: (serviceId: string) => void;
  onBlur: () => void;
  error?: string;
  errorId: string;
}) {
  const labelId = useId();
  const valueId = useId();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = services.find((service) => service.id === value) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = useMemo(
    () => services.filter((service) => {
      if (!normalizedQuery) return true;
      const specialty = getSpecialty(service.specialtyId)?.name ?? "";
      return `${service.name} ${specialty}`.toLocaleLowerCase("es").includes(normalizedQuery);
    }),
    [normalizedQuery, services],
  );

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function choose(serviceId: string) {
    onChange(serviceId);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <div
      ref={root}
      className="relative min-w-0 sm:col-span-2"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
    >
      <span id={labelId} className="mb-1.5 block text-[13px] font-semibold text-ink">
        Servicio del perfil
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["ArrowDown", "Enter", " "].includes(event.key) && !open) {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }
        }}
        className={`group flex min-h-16 w-full items-center gap-3 rounded-input border bg-white px-3 py-2.5 text-left outline-none transition-all hover:border-brand-600 hover:bg-brand-100/40 focus:border-brand-800 focus:ring-4 focus:ring-brand-100 ${
          error ? "border-danger" : open ? "border-brand-800" : "border-line-strong"
        }`}
      >
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-[10px] ${selected ? "bg-brand-100 text-brand-800" : "bg-surface-muted text-ink-faint"}`}>
          <Icon name="design_services" className="text-[20px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {selected ? (
            <>
              <span id={valueId} className="truncate text-[15px] font-bold leading-tight text-ink">{selected.name}</span>
              <span className="flex items-center gap-1 truncate text-[12px] font-medium text-ink-soft">
                <Icon name="account_tree" className="text-[14px] text-brand-600" />
                {getSpecialty(selected.specialtyId)?.name ?? selected.specialtyId}
              </span>
            </>
          ) : (
            <>
              <span id={valueId} className="text-[14.5px] font-semibold text-ink-soft">Elegí un servicio</span>
              <span className="text-[12px] text-ink-faint">La especialidad se asigna automáticamente</span>
            </>
          )}
        </span>
        <Icon name="expand_more" className={`flex-none text-[21px] text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-[110] mt-2 overflow-hidden rounded-card border border-line bg-white shadow-pop">
          <div className="border-b border-line-soft bg-surface-muted/60 p-2.5">
            <div className="flex items-center gap-2 rounded-input border border-line-strong bg-white px-3 focus-within:border-brand-800 focus-within:ring-4 focus-within:ring-brand-100">
              <Icon name="search" className="text-[18px] text-ink-faint" />
              <input
                ref={search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    requestAnimationFrame(() => trigger.current?.focus());
                  }
                  if (event.key === "Enter" && filtered.length === 1) {
                    event.preventDefault();
                    choose(filtered[0]!.id);
                  }
                }}
                placeholder="Buscar por servicio o especialidad…"
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint sm:text-[14px]"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken">
                  <Icon name="close" className="text-[17px]" />
                </button>
              ) : null}
            </div>
          </div>
          <p className="border-b border-line-soft px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">
            {filtered.length} {filtered.length === 1 ? "servicio disponible" : "servicios disponibles"}
          </p>
          <ul id={listId} role="listbox" aria-labelledby={labelId} className="max-h-[280px] overflow-y-auto p-1.5">
            {filtered.length ? filtered.map((service) => {
              const isSelected = service.id === value;
              return (
                <li key={service.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(service.id)}
                    className={`flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left transition-colors hover:bg-brand-100 ${isSelected ? "bg-brand-100" : "bg-white"}`}
                  >
                    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[9px] ${isSelected ? "bg-white text-brand-800 shadow-sm" : "bg-surface-muted text-ink-soft"}`}>
                      <Icon name={isSelected ? "check" : "design_services"} className="text-[18px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`truncate text-[14.5px] leading-tight ${isSelected ? "font-bold text-brand-800" : "font-semibold text-ink"}`}>{service.name}</span>
                      <span className="truncate text-[12px] text-ink-soft">{getSpecialty(service.specialtyId)?.name ?? service.specialtyId}</span>
                    </span>
                  </button>
                </li>
              );
            }) : (
              <li className="flex flex-col items-center gap-1 px-4 py-7 text-center">
                <Icon name="search_off" className="text-[25px] text-ink-faint" />
                <span className="text-[13.5px] font-semibold text-ink-soft">No encontramos ese servicio</span>
                <span className="text-[12px] text-ink-faint">Probá buscando por su especialidad.</span>
              </li>
            )}
          </ul>
        </div>
      ) : null}
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-[12px] text-danger">{error}</span> : null}
    </div>
  );
}
