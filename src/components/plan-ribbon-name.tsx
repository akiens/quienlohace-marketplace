import { PLAN_RIBBONS, PLAN_TIERS } from "@/domain/plans";
import type { PlanLimits } from "@/types";

/**
 * Cinta metálica compartida por las tarjetas públicas y el selector de plan.
 * Mantenerla en un solo componente evita que ambos lugares vuelvan a verse
 * como productos distintos.
 */
export function PlanRibbonName({
  plan,
  headingLevel = "h2",
}: {
  plan: PlanLimits;
  headingLevel?: "h2" | "h3";
}) {
  const ribbon = PLAN_RIBBONS[plan.id];
  const Heading = headingLevel;

  return (
    <div className="pointer-events-none absolute -left-3 right-0 top-5 z-10">
      <span
        aria-hidden="true"
        className="absolute left-0 top-full -z-10 h-3 w-3"
        style={{
          background: ribbon.fold,
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
        }}
      />
      <Heading
        className="flex min-h-[34px] items-center gap-2.5 rounded-r-sm py-1.5 pl-4 pr-5 text-[17px] font-bold tracking-[.2px] text-white shadow-[0_2px_6px_rgba(16,24,40,.18)] [text-shadow:0_1px_1px_rgba(0,0,0,.55),0_-1px_0_rgba(255,255,255,.18)]"
        style={{ background: ribbon.face }}
      >
        {plan.name}
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white [text-shadow:none]">
          {PLAN_TIERS[plan.id]}
        </span>
      </Heading>
    </div>
  );
}
