import Link from "next/link";
import Image from "next/image";

import { PLAN_BADGES, PLAN_RIBBONS, formatPrice } from "@/domain/plans";
import { Icon } from "@/components/ui";
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
 *   arranca (`?plan=`) en vez de llevar a `/planes`; en `/entrar` no hay nada
 *   que elegir y siguen siendo enlaces informativos.
 * @param selected id del plan elegido, para marcarlo.
 */
export async function PlanTeaser({
  selectable = false,
  selected,
}: {
  selectable?: boolean;
  selected?: PlanId;
} = {}) {
  const plans = hasCloudflareRuntime()
    ? await new D1PlanRepository().list()
    : FALLBACK;

  return (
    <div className="flex flex-col gap-3 border-t border-white/15 pt-5">
      <p className="text-[13px] font-semibold uppercase tracking-[.4px] text-[#9FB0CC]">
        Elegí con qué plan empezar
      </p>

      <ul className="flex flex-col gap-2">
        {plans.map((plan) => {
          const isSelected = selectable && plan.id === selected;
          return (
          <li key={plan.id}>
            {/*
              El degradado del metal reemplaza al gris parejo de antes: es lo
              que distingue una fila de otra de un vistazo. Va en el `style`
              porque cada plan tiene el suyo; el realce del hover queda en
              clases.

              La fila se cierra sólo por izquierda (borde y esquinas
              redondeadas en tres lados). Por derecha no lleva ni borde ni
              radio: el degradado se apaga contra el panel y la fila se
              desvanece en él, en vez de terminar en un canto que delataría
              dónde corta.
            */}
            <Link
              href={selectable ? `/registro?plan=${plan.id}` : `/planes#${plan.id}`}
              scroll={false}
              aria-current={isSelected ? "true" : undefined}
              style={{ backgroundImage: PLAN_RIBBONS[plan.id].row }}
              className={`group relative flex items-center gap-3 rounded-l-input py-2.5 pl-3 pr-1 transition-[filter] hover:brightness-125 ${
                isSelected ? "brightness-125" : ""
              }`}
            >
              {/*
                El borde va en una capa aparte, con `mask` que lo apaga hacia
                la derecha: si fuera un `border` normal cortaría en seco justo
                donde la fila tiene que estar desvaneciéndose.
              */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-l-input border-y border-l transition-colors group-hover:border-white/25 ${
                  isSelected ? "border-white/60" : "border-white/10"
                }`}
                style={{
                  maskImage:
                    "linear-gradient(90deg,#000 0%,#000 55%,transparent 85%)",
                  WebkitMaskImage:
                    "linear-gradient(90deg,#000 0%,#000 55%,transparent 85%)",
                }}
              />

              <Image
                src={PLAN_BADGES[plan.id]}
                alt=""
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 object-contain"
              />
              <span className="flex min-w-0 flex-col">
                {/*
                  La sombra sostiene el blanco sobre la parte cargada del
                  degradado: ahí el contraste plano se queda corto (Oro medía
                  3.4:1) y el texto es lo único que no puede perder legibilidad.
                */}
                <span className="text-[14.5px] font-semibold text-white [text-shadow:0_1px_2px_rgba(11,20,38,.75)]">
                  {plan.name}
                </span>
                <span className="truncate text-[12.5px] text-[#D5DEEC] [text-shadow:0_1px_2px_rgba(11,20,38,.7)]">
                  {HOOKS[plan.id]}
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
            </Link>
          </li>
          );
        })}
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
