"use server";

import { revalidatePath } from "next/cache";

import { PLAN_IDS } from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { requireUser } from "@/lib/session";
import type { FormState } from "@/app/actions/auth";
import type { PlanId } from "@/types";

/**
 * Cambio de plan desde el panel (RF-053).
 *
 * No cobra ni contrata nada: sólo cambia el plan del perfil. Lo que quedaba
 * fuera del plan anterior se reactiva y lo que ahora sobra se desactiva, sin
 * borrar nada, la próxima vez que se guarde el perfil.
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

  try {
    await providers.setPlan(provider.id, planId);
  } catch (error) {
    console.error("changePlan failed", error);
    return {
      errors: { form: "No fue posible cambiar el plan, probá de nuevo." },
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/profesionales/${provider.slug}`);
  return { message: "Plan actualizado." };
}
