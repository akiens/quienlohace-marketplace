"use server";

import { revalidatePath } from "next/cache";

import {
  effectivePlanId,
  nextPeriodEnd,
  planChangeKind,
  purgeDeadline,
} from "@/domain/plan-changes";
import { PLAN_IDS } from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { requireUser } from "@/lib/session";
import type { FormState } from "@/app/actions/auth";
import type { PlanId } from "@/types";

/**
 * Cambio de plan desde el panel (RF-053).
 *
 * Subir y bajar siguen caminos distintos, y la diferencia es de negocio:
 *
 *   - **Subir** se aplica al pagar. La acción no cobra —todavía no hay
 *     cobro—, así que deja el cambio listo y manda al asistente a completar
 *     el paso de pago, que es el que lo confirma.
 *   - **Bajar** se agenda para el fin del período pago. Lo que se pagó se
 *     sigue usando hasta que venza; recién ahí rige el plan nuevo y se
 *     empieza a cobrar ése.
 *
 * En ningún caso se borra nada: lo que queda fuera del plan nuevo se guarda
 * inactivo (RF-053) y se anota desde cuándo podría borrarse.
 */
export async function changePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const requested = formData.get("planId");
  if (!PLAN_IDS.includes(requested as PlanId)) {
    return { errors: { form: "Ese plan no existe." } };
  }
  const planId = requested as PlanId;

  if (!(await new D1PlanRepository().findById(planId))) {
    return { errors: { form: "Ese plan no está disponible." } };
  }

  const providers = new D1ProviderRepository();
  const provider = await providers.findByUserId(user.id);

  /*
   * Todavía sin perfil se puede cambiar de plan igual: no hay fila que
   * actualizar, así que sólo se confirma. El formulario se queda con el plan
   * elegido y lo manda al crear el perfil, que es donde se decide qué entra
   * y qué queda inactivo.
   */
  if (!provider) {
    return { message: "Plan actualizado." };
  }

  /*
   * Se compara contra el plan que rige hoy y no contra la columna: con una
   * baja agendada y el período todavía corriendo, la columna dice el plan
   * pago y ésa es justamente la que manda. Usar otra cosa haría que volver al
   * plan actual se leyera como un cambio.
   */
  const plans = new D1PlanRepository();
  const currentId = effectivePlanId({
    planId: provider.planId ?? "cobre",
    downgradePlanId: provider.downgradePlanId,
    planExpiresAt: provider.planExpiresAt,
  });

  const current = await plans.findById(currentId);
  const target = await plans.findById(planId);
  if (!current || !target) {
    return { errors: { form: "Ese plan no está disponible." } };
  }

  const kind = planChangeKind(current, target);

  try {
    if (kind === "same") {
      /*
       * Volver al plan que ya rige cancela una baja agendada: es la forma de
       * arrepentirse sin tener que ofrecer un botón aparte para eso.
       */
      await providers.cancelDowngrade(provider.id);
      revalidatePath("/dashboard");
      return { message: `Seguís en el plan ${target.name}.` };
    }

    if (kind === "upgrade") {
      /*
       * Subir es inmediato: se activa el plan y se corre el vencimiento un
       * período desde ahora. Las funciones nuevas quedan disponibles en el
       * acto, que es lo que permite que el asistente pueda mostrarlas.
       *
       * Queda `past_due` si el plan cuesta: el cobro todavía no se resolvió,
       * y eso es lo que mantiene el asistente abierto para completar los
       * campos nuevos y el pago. Sin esto la subida se daba por terminada y
       * no había forma de volver a ese paso.
       *
       * También deja sin efecto cualquier baja agendada: quien sube ya no se
       * está yendo.
       */
      await providers.setPlan(
        provider.id,
        planId,
        nextPeriodEnd(),
        target.priceCents > 0 ? "past_due" : "active",
      );
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/crear");
      revalidatePath(`/profesionales/${provider.slug}`);
      return {
        message:
          target.priceCents > 0
            ? `Plan ${target.name} activado. Completá los pasos nuevos y el pago.`
            : `Plan ${target.name} activado.`,
      };
    }

    /*
     * Bajar: se agenda para el vencimiento y no se toca lo que rige hoy.
     *
     * Si el perfil no tenía fecha de vencimiento se le pone una. Un plan pago
     * sin fecha existe —los creados antes de que hubiera cobro— y dejarla en
     * null haría que la baja se aplicara al instante y sin aviso.
     */
    await providers.scheduleDowngrade({
      providerId: provider.id,
      downgradePlanId: planId,
      expiresAt: provider.planExpiresAt ?? nextPeriodEnd(),
      purgeAfter: purgeDeadline(),
    });
  } catch (error) {
    console.error("changePlan failed", error);
    return {
      errors: { form: "No fue posible cambiar el plan, probá de nuevo." },
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/profesionales/${provider.slug}`);

  /*
   * Una baja siempre se agenda, así que el mensaje es siempre el de agendada.
   * Antes dependía de que el perfil ya tuviera fecha de vencimiento, y sin
   * ella decía "Plan X activado" — anunciando lo contrario de lo que pasaba.
   */
  return {
    message: `Vas a pasar al plan ${target.name} cuando termine tu período actual. Hasta entonces seguís con ${current.name}.`,
  };
}
