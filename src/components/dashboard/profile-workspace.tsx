"use client";

import { useState, useSyncExternalStore } from "react";

import { PlanSwitcher } from "@/components/dashboard/plan-switcher";
import { ProfileForm } from "@/components/dashboard/profile-form";
import {
  selectedPlanServerSnapshot,
  selectedPlanSnapshot,
  subscribeSelectedPlan,
  writeSelectedPlan,
} from "@/lib/selected-plan";
import type { PlanLimits, Provider, ProviderImage } from "@/types";

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
  images,
}: {
  provider: Provider | null;
  plan: PlanLimits;
  plans: PlanLimits[];
  images: ProviderImage[];
}) {
  const storedPlanId = useSyncExternalStore(
    subscribeSelectedPlan,
    selectedPlanSnapshot,
    selectedPlanServerSnapshot,
  );

  /*
   * Con perfil el plan lo decide la base, pero el panel no espera a que
   * vuelva: al confirmar se muestra el elegido y el servidor lo confirma por
   * detrás. Sin eso habría que volver a pedir la página entera sólo para ver
   * el cambio.
   */
  const [picked, setPicked] = useState<{
    planId: PlanLimits["id"];
    from: PlanLimits["id"];
  } | null>(null);

  /*
   * Cuando el servidor trae otro plan, la elección local ya cumplió y se
   * descarta durante el render — guardando de qué plan se partió alcanza para
   * notarlo, sin un efecto que provoque un render en cascada.
   */
  if (picked && picked.from !== plan.id) setPicked(null);

  const effectivePlanId =
    picked && picked.from === plan.id ? picked.planId : plan.id;

  const current = provider
    ? (plans.find((p) => p.id === effectivePlanId) ?? plan)
    : (plans.find((p) => p.id === storedPlanId) ?? plan);

  return (
    <>
      <PlanSwitcher
        plan={current}
        plans={plans}
        // Con perfil hay fila que actualizar; sin perfil el plan sólo se
        // recuerda hasta que se cree.
        persist={provider !== null}
        onPlanChange={(planId) => {
          setPicked({ planId, from: plan.id });
          // Se recuerda siempre: con perfil no decide nada, pero deja el
          // navegador al día en vez de con un valor viejo.
          writeSelectedPlan(planId);
        }}
      />
      <ProfileForm provider={provider} plan={current} images={images} />
    </>
  );
}
