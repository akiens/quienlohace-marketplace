"use client";

import Link from "next/link";

import { writeSelectedPlan } from "@/lib/selected-plan";
import type { PlanId } from "@/types";

/**
 * Botón de un plan en `/planes`: lleva al alta con ese plan ya elegido.
 *
 * Antes era un enlace pelado a `/registro` y el plan no viajaba: quien
 * comparaba los tres, apretaba Platino y llegaba al registro encontraba Cobre
 * marcado, y tenía que volver a elegir lo que acababa de elegir.
 *
 * La elección se recuerda en el navegador y no en la URL. `?plan=` quedaba
 * viejo al cambiar de plan más adelante —volver atrás resucitaba el anterior—
 * y era editable a mano. El servidor no confía en este valor: decide con lo
 * que llega en el envío y con el plan del perfil (RF-163).
 *
 * Sigue siendo un `<Link>` y no un botón: navega, así que tiene que poder
 * abrirse en otra pestaña y quedar en el historial. Escribir el plan en el
 * clic es un agregado, no lo que hace que la navegación ocurra.
 */
export function PlanCta({
  planId,
  className,
  children,
}: {
  planId: PlanId;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/registro#auth-form"
      onClick={() => writeSelectedPlan(planId)}
      className={className}
    >
      {children}
    </Link>
  );
}
