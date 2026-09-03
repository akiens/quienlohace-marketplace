import { PLAN_RANKS, isUpgrade } from "@/domain/plans";
import type { PlanId, PlanLimits } from "@/types";

/**
 * Reglas de los cambios de plan.
 *
 * Subir y bajar no son la misma operación, y la diferencia es de negocio:
 *
 *   - **Subir** es inmediato. Se activa el plan nuevo, se corre el
 *     vencimiento y las funciones quedan disponibles en el acto.
 *   - **Bajar** se agenda. El período que se pagó ya está cobrado y corre
 *     hasta su vencimiento: quitar las funciones antes sería cobrar por algo
 *     que se dejó de dar. Recién al vencer rige el plan menor.
 *
 * La baja agendada vive en `downgrade_plan_id`, que es NULL cuando no hay
 * ninguna. Al aplicarse vuelve a NULL.
 *
 * Todo lo que decide *cuándo* manda cada plan vive acá, y no repartido entre
 * la acción y las pantallas: el servidor y la UI tienen que contestar igual a
 * "qué puedo usar hoy", o una muestra campos que la otra rechaza.
 */

/** Qué clase de cambio es pasar de un plan a otro. */
export type PlanChangeKind = "upgrade" | "downgrade" | "same";

export function planChangeKind(
  from: PlanLimits,
  to: PlanLimits,
): PlanChangeKind {
  if (from.id === to.id) return "same";
  return isUpgrade(from, to) ? "upgrade" : "downgrade";
}

/**
 * Los datos de plan de un perfil, que es lo único que estas reglas miran.
 * Se pide así y no el `Provider` entero para poder resolverlo también sobre
 * una fila recién leída, sin armar el perfil completo.
 */
export type PlanState = {
  /** El plan contratado y vigente. */
  planId: PlanId;
  /** Plan al que se baja al vencer el período, o null si no hay baja. */
  downgradePlanId?: PlanId | null;
  /** Fin del período pago. NULL en Cobre, que no vence. */
  planExpiresAt?: string | null;
};

/**
 * El plan que rige **hoy**.
 *
 * Con una baja agendada y el período todavía corriendo manda el plan
 * contratado: es lo que se pagó. Vencido el período, manda el de la baja.
 *
 * Se resuelve al leer y no con una tarea que reescriba filas a medianoche:
 * así la respuesta es correcta en el instante en que se pregunta, sin
 * depender de que algo haya corrido antes. La consolidación de la fila usa
 * esta misma función para decidir, así nunca discrepan.
 */
export function effectivePlanId(
  state: PlanState,
  now: Date = new Date(),
): PlanId {
  const { planId, downgradePlanId, planExpiresAt } = state;

  if (!downgradePlanId || downgradePlanId === planId) return planId;

  /*
   * Sin fecha de vencimiento no se sabe cuándo termina el período pago, y eso
   * no es lo mismo que saber que ya terminó: sigue mandando el plan
   * contratado. Quien agenda la baja se encarga de dejar una fecha; ésta es
   * la red por si llega una fila sin ella.
   */
  if (!planExpiresAt) return planId;

  const expires = new Date(planExpiresAt);
  if (Number.isNaN(expires.getTime())) return planId;

  return expires.getTime() <= now.getTime() ? downgradePlanId : planId;
}

/**
 * Si hay una baja agendada que todavía no entró en vigencia.
 *
 * Es lo que hace falta para avisar en el perfil: hay una baja pedida, y hasta
 * la fecha se sigue usando el plan de ahora.
 */
export function hasScheduledDowngrade(
  state: PlanState,
  now: Date = new Date(),
): boolean {
  const { planId, downgradePlanId } = state;
  return (
    Boolean(downgradePlanId) &&
    downgradePlanId !== planId &&
    PLAN_RANKS[downgradePlanId!] < PLAN_RANKS[planId] &&
    effectivePlanId(state, now) === planId
  );
}

/**
 * Si la baja agendada ya venció y corresponde consolidarla en la fila.
 *
 * `effectivePlanId` ya devuelve el plan menor en ese caso, así que las
 * pantallas muestran lo correcto sin tocar nada. Esto es para que el perfil,
 * al abrirse, deje la fila al día: el plan bajado pasa a ser el contratado y
 * la baja se limpia.
 */
export function downgradeIsDue(
  state: PlanState,
  now: Date = new Date(),
): boolean {
  const { planId, downgradePlanId } = state;
  return (
    Boolean(downgradePlanId) &&
    downgradePlanId !== planId &&
    effectivePlanId(state, now) === downgradePlanId
  );
}

/**
 * Cuánto se conserva lo que quedó fuera del plan nuevo antes de poder
 * borrarlo.
 *
 * Bajar de plan no borra nada (RF-053): lo que excede queda inactivo y vuelve
 * solo si se recontrata. Esta ventana es para el caso de que no se vuelva —
 * seis meses, que cubre de sobra a quien baja por una temporada floja y
 * regresa.
 *
 * Es una fecha anotada, no un borrado: lo que la usa es una tarea aparte.
 */
export const EXCESS_RETENTION_DAYS = 180;

export function purgeDeadline(from: Date = new Date()): string {
  const deadline = new Date(from);
  deadline.setDate(deadline.getDate() + EXCESS_RETENTION_DAYS);
  return deadline.toISOString();
}

/**
 * Fin del período que se acaba de pagar: un mes desde ahora.
 *
 * Al subir de plan el vencimiento se corre desde el momento del cambio, que
 * es cuando se cobra. Cuando exista el cobro real, el período lo dirá la
 * suscripción y esta cuenta desaparece.
 */
export function nextPeriodEnd(from: Date = new Date()): string {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}
