"use client";

import { useEffect } from "react";

import { Icon } from "@/components/ui";

/** Una especialidad del perfil, como opción para colgarle un servicio. */
export type SpecialtyChoice = {
  id: string;
  /** Nombre de la especialidad. */
  name: string;
  /** Rubro al que pertenece, para desempatar homónimas. */
  sector?: string;
};

/**
 * A qué especialidad se cuelga un servicio escrito a mano.
 *
 * Los servicios son texto libre (BR-011), pero la base exige que cada uno
 * pertenezca a una especialidad del perfil (BR-010). Con una sola especialidad
 * elegida la respuesta es obvia y no se pregunta; con varias, la elección es
 * de la persona y no del programa.
 *
 * Antes se resolvía solo: el servicio escrito a mano se colgaba de la primera
 * especialidad del perfil, sin decirlo. Eso ponía un servicio de plomería bajo
 * "Electricidad" sin que nadie se enterara, y al bajar de plan —o al quitar
 * esa especialidad— desaparecía un servicio que no tenía nada que ver.
 */
export function ServiceSpecialtyDialog({
  serviceName,
  specialties,
  onChoose,
  onCancel,
}: {
  /** El servicio que se está agregando, para que se vea qué se está ubicando. */
  serviceName: string;
  /** Las especialidades del perfil. Siempre más de una: con una no se abre. */
  specialties: SpecialtyChoice[];
  onChoose: (specialtyId: string) => void;
  onCancel: () => void;
}) {
  // Escape cierra sin agregar, como cualquier diálogo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Elegí la especialidad del servicio"
      /*
       * En el teléfono se apoya abajo y ocupa todo el ancho: es donde llega el
       * pulgar, y la lista de especialidades puede ser larga.
       */
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:rounded-card sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[18px] font-bold text-ink sm:text-[20px]">
              ¿A qué especialidad pertenece?
            </h2>
            {/*
              Se repite el servicio que se está agregando: entre escribirlo y
              contestar esto se abre un diálogo, y conviene no depender de que
              la persona recuerde exactamente qué tecleó.
            */}
            <p className="text-[13.5px] text-ink-soft sm:text-[14px]">
              Estás agregando{" "}
              <strong className="font-semibold text-ink">{serviceName}</strong>.
              Elegí dónde va para que aparezca en las búsquedas correctas.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="-mr-1 flex h-10 w-10 flex-none items-center justify-center rounded-input text-ink-soft hover:bg-surface-muted sm:h-auto sm:w-auto sm:p-1.5"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {specialties.map((specialty) => (
            <li key={specialty.id}>
              <button
                type="button"
                onClick={() => onChoose(specialty.id)}
                className="flex w-full items-center gap-3 rounded-input border border-line bg-white px-4 py-3 text-left transition-colors hover:border-brand-800 hover:bg-brand-100"
              >
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[14.5px] font-semibold text-ink">
                    {specialty.name}
                  </span>
                  {specialty.sector ? (
                    <span className="truncate text-[12.5px] text-ink-soft">
                      {specialty.sector}
                    </span>
                  ) : null}
                </span>
                <Icon
                  name="chevron_right"
                  className="ml-auto text-[20px] text-ink-faint"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
