"use client";

import { useId, useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import {
  COUNTRY_LABEL,
  getLocation,
  listAreas,
  listDepartments,
  listLocalities,
  resolveLocationId,
} from "@/data/locations";

/**
 * Selectores dependientes País → Departamento → Localidad → Barrio.
 *
 * El modelo de datos es plano; la jerarquía se arma acá (RF-117). Cada nivel
 * es opcional: se precisa hasta donde se quiera y el id resultante es el del
 * último nivel elegido. Quien trabaja en todo un departamento no tiene por
 * qué nombrar una localidad, y quien no elige nada queda en todo el país.
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
  /** En modo alta, el botón confirma y los selectores vuelven a vacío. */
  addMode?: boolean;
}) {
  // Ids propios: puede haber más de un selector en la misma página.
  const fieldId = useId();

  const selected = value ? getLocation(value) : undefined;

  /*
   * Vacío es una respuesta válida, no un estado a completar: significa "no
   * bajo a este nivel". Por eso los selectores arrancan sin elegir en vez de
   * con el primer departamento de la lista.
   */
  const [department, setDepartment] = useState(selected?.department ?? "");
  const [locality, setLocality] = useState(selected?.locality ?? "");
  const [area, setArea] = useState(selected?.area ? value : "");

  const localities = department ? listLocalities(department) : [];
  const areas = department && locality ? listAreas(department, locality) : [];

  /** El id de lo elegido ahora mismo, parando donde se haya dejado de precisar. */
  function currentId(next?: {
    department?: string;
    locality?: string;
    area?: string;
  }): string {
    const pick = { department, locality, area, ...next };
    return resolveLocationId({
      department: pick.department || undefined,
      locality: pick.locality || undefined,
      area: pick.area || undefined,
    });
  }

  /** Fuera del modo alta cada cambio se refleja al toque en el formulario. */
  function sync(next: Parameters<typeof currentId>[0]) {
    if (!addMode) onChange(currentId(next));
  }

  function reset() {
    setDepartment("");
    setLocality("");
    setArea("");
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        Tres selectores no entran en media columna hasta que la pantalla es
        ancha de verdad: hasta ahí van apilados.
      */}
      <div className="flex flex-col gap-2 lg:flex-row">
        {name && !addMode ? (
          <input type="hidden" name={name} value={value} />
        ) : null}

        <Level id={`${fieldId}-department`} label="Departamento">
          <select
            id={`${fieldId}-department`}
            value={department}
            onChange={(event) => {
              const next = event.target.value;
              // Lo elegido más abajo deja de aplicar al cambiar de rama.
              setDepartment(next);
              setLocality("");
              setArea("");
              sync({ department: next, locality: "", area: "" });
            }}
            className={selectClass}
          >
            <option value="">Todo {COUNTRY_LABEL}</option>
            {listDepartments().map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Level>

        <Level id={`${fieldId}-locality`} label="Localidad">
          <select
            id={`${fieldId}-locality`}
            value={locality}
            disabled={!department}
            onChange={(event) => {
              const next = event.target.value;
              setLocality(next);
              setArea("");
              sync({ locality: next, area: "" });
            }}
            className={selectClass}
          >
            <option value="">
              {department ? `Todo ${department}` : "Elegí un departamento"}
            </option>
            {localities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Level>

        <Level id={`${fieldId}-area`} label="Barrio o zona">
          <select
            id={`${fieldId}-area`}
            value={area}
            disabled={areas.length === 0}
            onChange={(event) => {
              const next = event.target.value;
              setArea(next);
              sync({ area: next });
            }}
            className={selectClass}
          >
            <option value="">
              {locality
                ? `Todo ${locality}`
                : areas.length === 0
                  ? "Sin barrios cargados"
                  : "Elegí una localidad"}
            </option>
            {areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.area}
              </option>
            ))}
          </select>
        </Level>
      </div>

      {addMode ? (
        <button
          type="button"
          onClick={() => {
            onChange(currentId());
            reset();
          }}
          /*
           * Mismo tinte que las etiquetas, pero no se confunde con ellas: van
           * en píldora (`rounded-full`) y sin borde, y esto es un rectángulo
           * redondeado con borde y sombra. Blanco tampoco servía —era igual a
           * un campo para llenar—, que es el problema que se estaba evitando
           * al revés.
           */
          className={`flex h-8 items-center gap-1 self-start rounded-input pl-1.5 pr-2.5 text-[13px] font-semibold ${SECONDARY_SURFACE}`}
        >
          <Icon name="add" className="text-[16px]" />
          Agregar zona
        </button>
      ) : null}
    </div>
  );
}

/**
 * Cada selector dice qué nivel es, para no tener que deducirlo del contenido.
 *
 * El `label` envuelve sólo su texto y se ata al control por `htmlFor`: uno que
 * envolviera todo mandaría al select cualquier clic sobre el espacio libre de
 * la columna.
 */
function Level({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12.5px] font-semibold text-ink-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const selectClass =
  "h-11 w-full rounded-input border border-line-strong bg-white px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand-800 disabled:bg-surface-muted disabled:text-ink-muted";
