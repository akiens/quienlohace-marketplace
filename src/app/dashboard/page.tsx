import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PlanSwitcher } from "@/components/dashboard/plan-switcher";
import { ProfileView } from "@/components/dashboard/profile-view";
import { Icon } from "@/components/ui";
import {
  downgradeIsDue,
  effectivePlanId,
  hasScheduledDowngrade,
} from "@/domain/plan-changes";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { listImagesForUser } from "@/infrastructure/d1-provider-images";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { getCurrentUser } from "@/lib/session";
import type { PlanId } from "@/types";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false },
};

// El panel depende de la sesión: nunca se pregenera ni se cachea.
export const dynamic = "force-dynamic";

/**
 * El perfil del proveedor: mirarlo, publicarlo y editarlo.
 *
 * El alta vive en `/dashboard/crear` y se recorre una sola vez. Desde que el
 * perfil existe, todo pasa por acá: el modo edición muestra los campos que
 * habilita el plan vigente, así que subir de plan hace aparecer los nuevos
 * sin tener que volver al asistente.
 */
export default async function DashboardPage() {
  if (!hasCloudflareRuntime()) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const provider = await new D1ProviderRepository().findByUserId(user.id);

  // Sin perfil todavía no hay nada que mirar: se va al alta.
  if (!provider) redirect("/dashboard/crear");

  /*
   * Las imágenes se piden por usuario y no por perfil: es la misma consulta
   * que usa el alta, donde el perfil todavía no existe, y así las dos
   * pantallas ven exactamente lo mismo.
   */
  const images = await listImagesForUser(user.id);

  const allPlans = await new D1PlanRepository().list();

  /*
   * El plan que rige hoy, no el de la columna: con una baja agendada y el
   * período todavía corriendo sigue mandando el plan pago. Si acá se tomara
   * la columna a secas, bajar de plan apagaría las funciones en el acto —
   * cobrando un período que ya no se puede usar.
   */
  const planState = {
    planId: provider.planId ?? "cobre",
    downgradePlanId: provider.downgradePlanId,
    planExpiresAt: provider.planExpiresAt,
  };
  const planId: PlanId = effectivePlanId(planState);

  /*
   * Cada vez que se abre el perfil se evalúa la baja agendada: si ya venció,
   * se consolida en la fila —el plan bajado pasa a ser el contratado y
   * `downgrade_plan_id` vuelve a NULL—.
   *
   * Lo que se ve no depende de esto: `effectivePlanId` ya devuelve el plan
   * menor desde el instante del vencimiento. Esto deja la fila coherente con
   * lo que se muestra, que es lo que después leerá el cobro, y evita que la
   * baja quede colgada para siempre esperando una tarea que todavía no
   * existe.
   */
  if (downgradeIsDue(planState)) {
    await new D1ProviderRepository().applyDueDowngrade(provider.id, planId);
  }
  const plan =
    allPlans.find((p) => p.id === planId) ??
    allPlans.find((p) => p.id === "cobre");

  if (!plan) return <SetupNotice />;

  // Baja agendada que todavía no entró en vigencia: hay que avisarlo.
  const downgrade = hasScheduledDowngrade(planState)
    ? allPlans.find((p) => p.id === provider.downgradePlanId)
    : undefined;

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
          Mi perfil
        </h1>
        <p className="text-[15px] text-ink-soft">
          Revisá cómo quedó, publicalo cuando esté listo y editá lo que
          necesites.
        </p>
      </header>

      {downgrade ? (
        <p className="flex flex-wrap items-center gap-2 rounded-card border border-accent bg-accent-soft p-4 text-[14px] leading-relaxed text-accent-ink">
          <Icon name="schedule" className="text-[18px]" />
          Vas a pasar al plan {downgrade.name}
          {provider.planExpiresAt ? (
            <> el {formatDate(provider.planExpiresAt)}</>
          ) : null}
          . Hasta entonces seguís usando todo lo de {plan.name}; lo que no
          entre en {downgrade.name} se guarda por si volvés.
        </p>
      ) : null}

      <PlanSwitcher plan={plan} plans={allPlans} persist />

      <ProfileView provider={provider} plan={plan} images={images} />
    </div>
  );
}

/** Fecha corta y legible: "12 de marzo de 2027". */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Sin bindings de Cloudflare el panel no puede leer ni escribir en D1. */
function SetupNotice() {
  return (
    <div className="shell flex flex-col items-start gap-4 py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
        <Icon name="database" className="text-[24px] text-brand-800" />
      </span>
      <h1 className="text-[24px] font-bold tracking-[-.4px] text-ink">
        Falta conectar la base de datos
      </h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">
        El panel del proveedor necesita el runtime de Cloudflare con el binding
        D1. Para trabajar sobre el panel usá{" "}
        <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-[13.5px]">
          npm run preview
        </code>
        , que levanta el sitio sobre Workers con la base local. Los pasos están
        en el README.
      </p>
      <Link
        href="/"
        className="flex h-10 items-center rounded-input bg-brand-800 px-4 text-[14px] font-semibold text-white hover:bg-brand-900"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
