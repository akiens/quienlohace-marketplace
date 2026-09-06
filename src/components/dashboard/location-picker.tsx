"use client";

import { useId, useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import {
  COUNTRY_ID,
  COUNTRY_LABEL,
  getLocation,
  listDepartments,
  listLocalities,
} from "@/data/locations";

/**
 * Selectores dependientes País → Departamento → Localidad (BR-014).
 *
 * Son tres niveles y no cuatro: los barrios salieron del catálogo, y la
 * localidad es lo más preciso que se puede elegir.
 *
 * Cada nivel es opcional: se precisa hasta donde se quiera y el id resultante
 * es el del último elegido. Quien trabaja en todo un departamento no tiene por
 * qué nombrar una localidad, y quien no elige nada queda en todo el país —que
 * como área de servicio es cobertura nacional (BR-016).
 *
 * `allowCountry` en false es para las ubicaciones físicas: Uruguay no dice
 * dónde está el local, así que ahí no es una opción válida (BR-015).
 */
export function LocationPicker({
  name,
  value,
  onChange,
  addMode = false,
  allowCountry = true,
}: {
  name?: string;
  value: string;
  onChange: (locationId: string) => void;
  /** En modo alta, el botón confirma y los selectores vuelven a vacío. */
  addMode?: boolean;
  /** BR-015: las ubicaciones físicas no admiten el país. */
  allowCountry?: boolean;
}) {
  // Ids propios: puede haber más de un selector en la misma página.
  const fieldId = useId();

  const selected = value ? getLocation(value) : undefined;

  /*
   * El departamento vigente: el propio si lo elegido es un departamento, o el
   * padre si es una localidad. Vacío es una respuesta válida —"no bajo a este
   * nivel"—, así que los selectores arrancan sin elegir en vez de con el
   * primer departamento de la lista.
   */
  const [department, setDepartment] = useState(() => {
    if (selected?.type === "department") return selected.id;
    if (selected?.type === "locality") return selected.parentId ?? "";
    return "";
  });
  const [locality, setLocality] = useState(
    selected?.type === "locality" ? selected.id : "",
  );

  const departments = listDepartments();
  const localities = department ? listLocalities(department) : [];

  /** El id de lo elegido ahora mismo, parando donde se dejó de precisar. */
  function currentId(next?: { department?: string; locality?: string }): string {
    const pick = { department, locality, ...next };
    return pick.locality || pick.department || COUNTRY_ID;
  }

  /** Fuera del modo alta cada cambio se refleja al toque en el formulario. */
  function sync(next: Parameters<typeof currentId>[0]) {
    if (!addMode) onChange(currentId(next));
  }

  function reset() {
    setDepartment("");
    setLocality("");
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        De a dos por fila ya desde `sm`: son "Departamento" y "Localidad", dos
        listas cortas, y esperar a `lg` dejaba dos selectores gigantes uno
        arriba del otro en toda tablet.
      */}
      <div className="flex flex-col gap-2 sm:flex-row">
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
              sync({ department: next, locality: "" });
            }}
            className={selectClass}
          >
            {/*
              Sin país no hay opción neutra: elegir un departamento es
              obligatorio, y el texto lo dice en vez de dejar un vacío que
              parece un dato sin cargar.
            */}
            <option value="">
              {allowCountry ? `Todo ${COUNTRY_LABEL}` : "Elegí un departamento"}
            </option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
              sync({ locality: next });
            }}
            className={selectClass}
          >
            <option value="">
              {department
                ? `Todo ${getLocation(department)?.name ?? "el departamento"}`
                : "Elegí un departamento"}
            </option>
            {localities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Level>
      </div>

      {addMode ? (
        <button
          type="button"
          // Sin país no se puede confirmar "todo Uruguay" (BR-015).
          disabled={!allowCountry && !department}
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
          className={`flex h-12 w-full items-center justify-center gap-1 rounded-input px-3 text-[14.5px] font-semibold disabled:opacity-50 sm:h-8 sm:w-auto sm:self-start sm:pl-1.5 sm:pr-2.5 sm:text-[13px] ${SECONDARY_SURFACE}`}
        >
          <Icon name="add" className="text-[18px] sm:text-[16px]" />
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
      <label htmlFor={id} className="text-[12.5px] font-semibold text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/* 16px en el teléfono: por debajo, iOS hace zoom al enfocar el selector. */
const selectClass =
  "h-12 w-full rounded-input border border-line-strong bg-white px-3 text-[16px] text-ink outline-none transition-colors focus:border-brand-800 disabled:bg-surface-muted disabled:text-ink-muted sm:h-11 sm:text-[15px]";
