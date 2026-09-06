"use client";

import { useState, useTransition } from "react";

import { dismissDowngradeNotice } from "@/app/actions/plan";
import { Icon } from "@/components/ui";
import type { DowngradeNoticeStage } from "@/domain/plan-changes";

/**
 * El aviso de la baja de plan agendada: una banda debajo del encabezado, que
 * se puede cerrar.
 *
 * Va sin esquinas redondeadas y de borde a borde, como una banda del sistema y
 * no como una tarjeta más del perfil: es una novedad sobre la cuenta, no
 * contenido del perfil, y la diferencia de forma es la que lo dice.
 *
 * Cerrarlo no espera al servidor: desaparece en el acto y la escritura va por
 * detrás. Es lo correcto para algo cuyo peor error posible es que el aviso
 * vuelva a aparecer en la próxima visita — mucho menos molesto que un cartel
 * que se queda medio segundo después de haberlo cerrado.
 */
export function DowngradeNotice({
  planName,
  downgradePlanName,
  effectiveOn,
  stage,
}: {
  /** El plan que rige hasta el vencimiento. */
  planName: string;
  /** El plan al que se baja. */
  downgradePlanName: string;
  /** Cuándo entra en vigencia, ya formateado, o null si no hay fecha. */
  effectiveOn: string | null;
  /**
   * Cuál de los dos avisos es. El recordatorio de los últimos días se cierra
   * por su cuenta: cerrar el normal no lo silencia.
   */
  stage: DowngradeNoticeStage;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  const reminder = stage === "reminder";

  return (
    <div
      role="status"
      /*
       * El recordatorio de los últimos días se ve distinto del normal: es el
       * mismo hecho, pero ya casi no queda tiempo de reaccionar y el color lo
       * dice antes que el texto.
       */
      className={`flex items-start gap-2.5 border-b px-5 py-3 text-[14px] leading-relaxed sm:px-6 ${
        reminder
          ? "border-[#F5C6A5] bg-[#FEF6EE] text-[#8A4B10]"
          : "border-accent bg-accent-soft text-accent-ink"
      }`}
    >
      <Icon
        name={reminder ? "warning" : "schedule"}
        className="mt-0.5 shrink-0 text-[18px]"
      />

      <p className="min-w-0 flex-1">
        {reminder ? (
          <>
            <strong className="font-bold">
              {effectiveOn ? `El ${effectiveOn}` : "En los próximos días"} pasás
              al plan {downgradePlanName}.
            </strong>{" "}
            Si querés seguir con {planName}, cambiá el plan antes de esa fecha.
            Lo que no entre en {downgradePlanName} deja de mostrarse, pero se
            guarda por si volvés.
          </>
        ) : (
          <>
            Vas a pasar al plan {downgradePlanName}
            {effectiveOn ? ` el ${effectiveOn}` : null}. Hasta entonces seguís
            usando todo lo de {planName}; lo que no entre en{" "}
            {downgradePlanName} se guarda por si volvés.
          </>
        )}
      </p>

      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => {
          setDismissed(true);
          startTransition(async () => {
            const data = new FormData();
            data.set("stage", stage);
            await dismissDowngradeNotice({}, data);
          });
        }}
        /*
         * 36px alrededor de la cruz: con el icono a secas se le erraba en el
         * teléfono y el aviso se quedaba puesto.
         */
        className="-my-1 -mr-2 flex h-9 w-9 flex-none items-center justify-center rounded-input transition-colors hover:bg-black/5"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
