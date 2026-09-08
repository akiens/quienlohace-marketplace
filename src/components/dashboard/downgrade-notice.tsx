"use client";

import { dismissDowngradeNotice } from "@/app/actions/plan";
import { Banner } from "@/components/banner";
import type { DowngradeNoticeStage } from "@/domain/plan-changes";

/**
 * El aviso de la baja de plan agendada.
 *
 * Es un `Banner` con el contenido de este caso: qué plan viene, cuándo, y qué
 * pasa con lo que no entra. El aviso en sí —dónde se dibuja, el color, la
 * cruz, el cierre optimista— lo resuelve el `Banner`; acá queda sólo lo que
 * es propio de la baja de plan.
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
  const reminder = stage === "reminder";

  return (
    <Banner
      /*
       * El recordatorio de los últimos días va en otro tono: es el mismo
       * hecho, pero ya casi no queda tiempo de reaccionar y el color lo dice
       * antes que el texto.
       */
      tone={reminder ? "warning" : "info"}
      icon={reminder ? "warning" : "schedule"}
      /*
       * Se anota en el perfil que ya se leyó: "ya lo vi" es una decisión de la
       * persona, no del aparato, y cerrado en la computadora tampoco tiene que
       * volver a saltar en el teléfono.
       *
       * La etapa viaja en el envío porque el aviso normal y el recordatorio se
       * cierran por separado: sin distinguirlos, cerrar el primero silenciaría
       * al segundo, que es el que avisa que la baja es en tres días.
       */
      onBeforeDismiss={async () => {
        const data = new FormData();
        data.set("stage", stage);
        await dismissDowngradeNotice({}, data);
      }}
    >
      {reminder ? (
        <>
          <strong className="font-bold">
            {effectiveOn ? `El ${effectiveOn}` : "En los próximos días"} pasás
            al plan {downgradePlanName}.
          </strong>{" "}
          Si querés seguir con {planName}, cambiá el plan antes de esa fecha. Lo
          que no entre en {downgradePlanName} deja de mostrarse, pero se guarda
          por si volvés.
        </>
      ) : (
        <>
          Vas a pasar al plan {downgradePlanName}
          {effectiveOn ? ` el ${effectiveOn}` : null}. Hasta entonces seguís
          usando todo lo de {planName}; lo que no entre en {downgradePlanName}{" "}
          se guarda por si volvés.
        </>
      )}
    </Banner>
  );
}
