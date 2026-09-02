"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { PLAN_BADGES, PLAN_RIBBONS, formatPrice } from "@/domain/plans";
import { Icon } from "@/components/ui";
import {
  selectedPlanServerSnapshot,
  selectedPlanSnapshot,
  subscribeSelectedPlan,
  writeSelectedPlan,
} from "@/lib/selected-plan";
import type { PlanId, PlanLimits } from "@/types";

type TeaserPlan = Pick<PlanLimits, "id" | "name" | "priceCents">;

/**
 * Filas de plan del panel de acceso.
 *
 * En `/registro` eligen con qué plan se arranca y lo recuerdan en el
 * navegador; en `/entrar` no hay nada que elegir y son enlaces a `/planes`.
 *
 * La elección no viaja por la URL: quedaba desactualizada al cambiar de plan
 * en el panel y era editable a mano. El servidor no confía en este valor —
 * decide con lo que llega en el envío y con el plan del perfil (RF-163).
 */
export function PlanPicker({
  plans,
  hooks,
  selectable = false,
}: {
  plans: TeaserPlan[];
  hooks: Record<PlanId, string>;
  selectable?: boolean;
}) {
  /*
   * El plan vive en el navegador, que es un almacén externo a React.
   * `useSyncExternalStore` lo lee sin romper la hidratación (el servidor
   * rinde Cobre) y mantiene esta lista y el formulario en sincronía.
   */
  const selected = useSyncExternalStore(
    subscribeSelectedPlan,
    selectedPlanSnapshot,
    selectedPlanServerSnapshot,
  );

  return (
    <>
      {/* El plan viaja con el alta; el servidor lo vuelve a validar. */}
      {selectable ? (
        <input type="hidden" name="planId" value={selected} form="auth-form" />
      ) : null}

      <ul className="flex flex-col gap-2">
        {plans.map((plan) => {
          const isSelected = selectable && plan.id === selected;
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-l-input border-y border-l transition-colors group-hover:border-white/25 ${
                  isSelected
                    ? "rounded-r-sm border-r border-white/60"
                    : "border-white/10"
                }`}
                style={
                  isSelected
                    ? undefined
                    : {
                        maskImage:
                          "linear-gradient(90deg,#000 0%,#000 55%,transparent 85%)",
                        WebkitMaskImage:
                          "linear-gradient(90deg,#000 0%,#000 55%,transparent 85%)",
                      }
                }
              />

              <Image
                src={PLAN_BADGES[plan.id]}
                alt=""
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 object-contain"
              />
              <span className="flex min-w-0 flex-col text-left">
                <span className="text-[14.5px] font-semibold text-white [text-shadow:0_1px_2px_rgba(11,20,38,.75)]">
                  {plan.name}
                </span>
                <span className="truncate text-[12.5px] text-[#D5DEEC] [text-shadow:0_1px_2px_rgba(11,20,38,.7)]">
                  {hooks[plan.id]}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5 pr-3 text-[13px] font-semibold text-accent">
                {isSelected ? (
                  <Icon
                    name="check_circle"
                    filled
                    className="text-[16px] text-white"
                  />
                ) : null}
                {formatPrice(plan)}
              </span>
            </>
          );

          const className = `group relative flex w-full items-center gap-3 rounded-l-input py-2.5 pl-3 pr-1 transition-[filter] hover:brightness-125 ${
            isSelected ? "brightness-125" : ""
          }`;

          return (
            <li key={plan.id}>
              {selectable ? (
                <button
                  type="button"
                  onClick={() => writeSelectedPlan(plan.id)}
                  aria-pressed={isSelected}
                  style={{ backgroundImage: PLAN_RIBBONS[plan.id].row }}
                  className={className}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  href={`/planes#${plan.id}`}
                  style={{ backgroundImage: PLAN_RIBBONS[plan.id].row }}
                  className={className}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
