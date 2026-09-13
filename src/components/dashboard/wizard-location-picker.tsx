"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  COUNTRY_ID,
  departmentOf,
  listDepartments,
  listLocalities,
  locationLabelById,
  normalizeServiceAreas,
} from "@/data/locations";
import { normalize } from "@/data/services";
import { WizardDialog } from "./wizard-dialog";

export function WizardLocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[38px] w-full rounded-input border border-line-strong px-3 text-left text-base text-ink"
      >
        {value ? locationLabelById(value) : "Elegí la localidad del local"}
      </button>
      {open && (
        <LocalityDialog
          initial={value}
          onClose={() => setOpen(false)}
          onConfirm={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function LocalityDialog({
  initial,
  onClose,
  onConfirm,
}: {
  initial: string;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const [selected, setSelected] = useState(initial);
  const [department, setDepartment] = useState(departmentOf(initial)?.id ?? "");
  const [query, setQuery] = useState("");
  const departments = listDepartments();
  const rows = (
    query
      ? departments.flatMap((item) => listLocalities(item.id))
      : department
        ? listLocalities(department)
        : []
  ).filter((item) =>
    normalize(locationLabelById(item.id)).includes(normalize(query)),
  );
  return (
    <WizardDialog title="Elegí la localidad" onClose={onClose}>
      <label className="mb-4 block text-sm font-semibold">
        Buscar localidad
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: Las Piedras"
          className="mt-2 h-[38px] w-full rounded-input border border-line-strong px-3 text-base font-normal"
        />
      </label>
      {department && !query && (
        <button
          type="button"
          onClick={() => setDepartment("")}
          className="mb-2 min-h-12 text-sm font-semibold text-brand-800"
        >
          ← Ver departamentos
        </button>
      )}
      {!department && !query ? (
        <ul className="divide-y divide-line-soft">
          {departments.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setDepartment(item.id)}
                className="min-h-12 w-full px-2 py-3 text-left"
              >
                {item.name} →
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm text-ink-soft">
            {query ? "Resultados" : locationLabelById(department)}
          </legend>
          {rows.map((item) => (
            <label
              key={item.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-line-soft px-2 py-3"
            >
              <input
                type="radio"
                name="wizard-locality-choice"
                value={item.id}
                checked={selected === item.id}
                onChange={() => setSelected(item.id)}
                className="h-5 w-5 accent-brand-800"
              />
              <span className="text-sm">{locationLabelById(item.id)}</span>
            </label>
          ))}
          {!rows.length && (
            <p className="py-4 text-sm text-ink-soft">
              No encontramos localidades con ese nombre.
            </p>
          )}
        </fieldset>
      )}
      <div className="sticky bottom-0 mt-4 space-y-2 border-t border-line-soft bg-white py-3">
        <p className="text-sm text-ink-soft">
          {selected
            ? `Seleccionaste: ${locationLabelById(selected)}`
            : "Seleccioná una localidad para confirmar."}
        </p>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => onConfirm(selected)}
          className="w-full"
        >
          Confirmar ubicación
        </Button>
      </div>
    </WizardDialog>
  );
}

export function CoverageChoices({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = value.length ? value : [COUNTRY_ID];
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((item) => item !== id));
    else
      onChange(
        id === COUNTRY_ID
          ? [COUNTRY_ID]
          : normalizeServiceAreas([
              ...selected.filter((item) => item !== COUNTRY_ID),
              id,
            ]),
      );
  }
  const row = (id: string, label: string, disabled = false) => (
    <label
      key={id}
      className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-3 text-sm ${disabled ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected.includes(id) || disabled}
        disabled={
          disabled || (id === COUNTRY_ID && selected.includes(COUNTRY_ID))
        }
        onChange={() => toggle(id)}
        className="h-5 w-5 shrink-0 accent-brand-800"
      />
      {label}
    </label>
  );
  return (
    <div className="space-y-3">
      {selected.map((id) => (
        <input key={id} type="hidden" name="serviceAreaIds" value={id} />
      ))}
      <p className="text-sm text-ink-soft">
        {selected.includes(COUNTRY_ID)
          ? "Tu cobertura es todo Uruguay. Elegí zonas para acotarla."
          : `Zonas elegidas: ${selected.map(locationLabelById).join(" · ")}`}
      </p>
      {row(COUNTRY_ID, "Todo Uruguay")}
      <input
        aria-label="Buscar zona de cobertura"
        placeholder="Buscar departamento o localidad…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-[38px] w-full rounded-input border border-line-strong px-3 text-base"
      />
      {listDepartments().map((department) => {
        const matchesDepartment = normalize(department.name).includes(
          normalize(query),
        );
        const localities = listLocalities(department.id).filter(
          (item) =>
            matchesDepartment ||
            normalize(item.name).includes(normalize(query)),
        );
        if (!matchesDepartment && !localities.length) return null;
        return (
          <details
            key={department.id}
            open={query ? true : undefined}
            className="rounded-input border border-line"
          >
            <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-semibold">
              {department.name}
              {selected.includes(department.id)
                ? " · Todo el departamento"
                : ""}
            </summary>
            {row(department.id, `Todo ${department.name}`)}
            {selected.includes(department.id) && (
              <p className="px-3 pb-3 text-xs text-ink-soft">
                Incluye todas sus localidades. Desmarcá el departamento para
                elegir sólo algunas.
              </p>
            )}
            {localities.map((item) =>
              row(item.id, item.name, selected.includes(department.id)),
            )}
          </details>
        );
      })}
    </div>
  );
}
