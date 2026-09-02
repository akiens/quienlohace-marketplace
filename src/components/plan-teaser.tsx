import Link from "next/link";

import { PlanPicker } from "@/components/plan-picker";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import type { PlanId, PlanLimits } from "@/types";

/**
 * Adelanto de planes dentro del panel de `/entrar` y `/registro`.
 *
 * No es una comparación: RF-053 vive en `/planes`. Acá sólo se avisa que el
 * perfil tiene niveles y se lleva a la página que sí los compara, así que de
 * cada plan se muestra el gancho más corto posible (insignia, nombre, precio).
 */

/** Gancho de una línea por plan. El nombre y el precio salen de la base. */
const HOOKS: Record<PlanId, string> = {
  cobre: "Tu perfil publicado",
  gold: "Galería y más rubros",
  platinum: "Destacados y landing",
};

/**
 * Precios de respaldo para cuando no hay runtime de Cloudflare (por ejemplo
 * `next build` sin bindings). Coinciden con los valores iniciales de la
 * migración: si en la base cambiaron, manda la base.
 */
const FALLBACK: Array<Pick<PlanLimits, "id" | "name" | "priceCents">> = [
  { id: "cobre", name: "Cobre", priceCents: 0 },
  { id: "gold", name: "Oro", priceCents: 500 },
  { id: "platinum", name: "Platino", priceCents: 2000 },
];

/**
 * @param selectable en `/registro` cada fila elige el plan con el que se
 *   arranca; en `/entrar` no hay nada que elegir y son enlaces informativos.
 */
export async function PlanTeaser({
  selectable = false,
}: {
  selectable?: boolean;
} = {}) {
  const plans = hasCloudflareRuntime()
    ? await new D1PlanRepository().list()
    : FALLBACK;

  return (
    <div className="flex flex-col gap-3 border-t border-white/15 pt-5">
      <p className="text-[13px] font-semibold uppercase tracking-[.4px] text-[#9FB0CC]">
        Elegí con qué plan empezar
      </p>

      {/* La selección es interactiva y vive en el cliente. */}
      <PlanPicker
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          priceCents: plan.priceCents,
        }))}
        hooks={HOOKS}
        selectable={selectable}
      />

      <Link
        href="/planes"
        className="text-[13px] font-semibold text-white underline underline-offset-4 hover:text-accent"
      >
        Ver qué incluye cada plan
      </Link>
    </div>
  );
}
