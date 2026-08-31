"use client";

import { useState } from "react";

import {
  getLocation,
  listAreas,
  listDepartments,
  listLocalities,
  localityId,
} from "@/data/locations";

/**
 * Selectores dependientes Departamento → Localidad → Barrio.
 *
 * El modelo de datos es plano; la jerarquía se arma acá (RF-117). El tercer
 * selector sólo aparece si la localidad tiene zonas cargadas.
 */
export function LocationPicker({
  name,
  value,
  onChange,
  addMode = false,
}: {
  name?: string;
  value: string;
  onChange: (locationId: string) => void;
  /** En modo alta, al elegir una zona se emite y se limpia el control. */
  addMode?: boolean;
}) {
  const selected = value ? getLocation(value) : undefined;

  const [department, setDepartment] = useState(
    selected?.department ?? listDepartments()[0] ?? "Montevideo",
  );
  const [locality, setLocality] = useState(
    selected?.locality ?? listLocalities(department)[0] ?? "",
  );

  const localities = listLocalities(department);
  const areas = listAreas(department, locality);

  function emit(id: string) {
    onChange(id);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {name && !addMode ? (
        <input type="hidden" name={name} value={value} />
      ) : null}

      <select
        aria-label="Departamento"
        value={department}
        onChange={(event) => {
          const next = event.target.value;
          const firstLocality = listLocalities(next)[0] ?? "";
          setDepartment(next);
          setLocality(firstLocality);
          // Al cambiar de departamento la selección anterior deja de aplicar.
          if (!addMode && firstLocality) {
            emit(localityId(next, firstLocality));
          }
        }}
        className={selectClass}
      >
        {listDepartments().map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        aria-label="Ciudad o localidad"
        value={locality}
        onChange={(event) => {
          const next = event.target.value;
          setLocality(next);
          if (!addMode) emit(localityId(department, next));
        }}
        className={selectClass}
      >
        {localities.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {areas.length > 0 ? (
        <select
          aria-label="Barrio o zona"
          value={addMode ? "" : value}
          onChange={(event) => {
            const next = event.target.value;
            if (next) emit(next);
          }}
          className={selectClass}
        >
          <option value={addMode ? "" : localityId(department, locality)}>
            {addMode ? "Elegí una zona…" : `Toda ${locality}`}
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.area}
            </option>
          ))}
        </select>
      ) : addMode ? (
        <button
          type="button"
          onClick={() => emit(localityId(department, locality))}
          className="h-11 flex-none rounded-input bg-brand-100 px-4 text-[14px] font-semibold text-brand-800 hover:bg-[#E3E8F1]"
        >
          Agregar
        </button>
      ) : null}
    </div>
  );
}

const selectClass =
  "h-11 w-full rounded-input border border-line-strong bg-white px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand-800";
