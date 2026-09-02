"use client";

import { useSyncExternalStore } from "react";

import { PlanSwitcher } from "@/components/dashboard/plan-switcher";
import { ProfileForm } from "@/components/dashboard/profile-form";
import {
  selectedPlanServerSnapshot,
  selectedPlanSnapshot,
  subscribeSelectedPlan,
  writeSelectedPlan,
} from "@/lib/selected-plan";
import type { PlanLimits, Provider } from "@/types";

/**
 * Une el bloque de plan con el formulario.
 *
 * Sin perfil todavía no hay dónde guardar el plan, así que manda el que
 * eligió el navegador: se puede cambiar libremente y el formulario se
 * reordena al instante. Con perfil creado manda el de la base, que es el
 * único que vale.
 *
 * El plan elegido no viaja por la URL. Antes sí, y traía el problema de que
 * al cambiar de plan el parámetro quedaba viejo: volver atrás o recargar con
 * ese enlace resucitaba el plan anterior.
 */
export function ProfileWorkspace({
  provider,
  plan,
  plans,
}: {
  provider: Provider | null;
  plan: PlanLimits;
  plans: PlanLimits[];
}) {
  const storedPlanId = useSyncExternalStore(
    subscribeSelectedPlan,
    selectedPlanSnapshot,
    selectedPlanServerSnapshot,
  );

  /*
   * Con perfil, el plan sale del servidor y el almacenamiento no interviene:
   * así el panel nunca contradice a la base.
   */
  const current = provider
    ? plan
    : (plans.find((p) => p.id === storedPlanId) ?? plan);

  return (
    <>
      <PlanSwitcher
        plan={current}
        plans={plans}
        // Se recuerda siempre: con perfil no decide nada, pero deja el
        // navegador al día en vez de con un valor viejo.
        onPlanChange={writeSelectedPlan}
      />
      <ProfileForm provider={provider} plan={current} />
    </>
  );
}
