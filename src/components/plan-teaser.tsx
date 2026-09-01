import Link from "next/link";
import Image from "next/image";

import { PLAN_BADGES, formatPrice } from "@/domain/plans";
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
  { id: "gold", name: "Gold", priceCents: 500 },
  { id: "platinum", name: "Platinum", priceCents: 2000 },
];

export async function PlanTeaser() {
  const plans = hasCloudflareRuntime()
    ? await new D1PlanRepository().list()
    : FALLBACK;

  return (
    <div className="flex flex-col gap-3 border-t border-white/15 pt-5">
      <p className="text-[13px] font-semibold uppercase tracking-[.4px] text-[#9FB0CC]">
        Elegí con qué plan empezar
      </p>

      <ul className="flex flex-col gap-2">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link
              href={`/planes#${plan.id}`}
              className="flex items-center gap-3 rounded-input bg-white/10 px-3 py-2.5 transition-colors hover:bg-white/[.18]"
            >
              <Image
                src={PLAN_BADGES[plan.id]}
                alt=""
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 object-contain"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14.5px] font-semibold text-white">
                  {plan.name}
                </span>
                <span className="truncate text-[12.5px] text-[#C3CEE2]">
                  {HOOKS[plan.id]}
                </span>
              </span>
              <span className="ml-auto shrink-0 text-[13px] font-semibold text-accent">
                {formatPrice(plan)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/planes"
        className="text-[13px] font-semibold text-white underline underline-offset-4 hover:text-accent"
      >
        Ver qué incluye cada plan
      </Link>
    </div>
  );
}
