import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/dashboard/profile-form";
import { PublishToggle } from "@/components/dashboard/publish-toggle";
import { Icon } from "@/components/ui";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { D1ProviderRepository } from "@/infrastructure/d1-provider-repository";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { getCurrentUser } from "@/lib/session";
import { PLAN_IDS, formatPrice } from "@/domain/plans";
import type { PlanId, PlanLimits } from "@/types";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false },
};

// El panel depende de la sesión: nunca se pregenera ni se cachea.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  if (!hasCloudflareRuntime()) {
    return <SetupNotice />;
  }

  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const provider = await new D1ProviderRepository().findByUserId(user.id);

  /*
   * Qué plan manda: el del perfil si ya existe, y si todavía no hay perfil,
   * el que se eligió en el registro y viene en la URL. El parámetro se
   * ignora cuando ya hay perfil, para que no se pueda cambiar de plan
   * escribiendo en la barra de direcciones.
   */
  const requested = (await searchParams).plan;
  const planId: PlanId =
    provider?.planId ??
    (PLAN_IDS.includes(requested as PlanId) ? (requested as PlanId) : "cobre");

  // El plan define los topes del formulario. Si faltara la fila, se cae a
  // Cobre: es preferible el plan más restrictivo que un panel roto.
  const planRepo = new D1PlanRepository();
  const plan =
    (await planRepo.findById(planId)) ?? (await planRepo.findById("cobre"));

  if (!plan) return <SetupNotice />;

  return (
    <div className="shell flex flex-col gap-7 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
            {provider ? "Mi perfil" : "Creá tu perfil"}
          </h1>
          <p className="text-[15px] text-ink-soft">
            {provider
              ? "Actualizá tus datos, servicios y zonas de trabajo."
              : "Completá estos datos para aparecer en las búsquedas."}
          </p>
        </div>

        {provider ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <PublishToggle status={provider.status ?? "draft"} />
            {provider.status === "active" ? (
              <Link
                href={`/profesionales/${provider.slug}`}
                className="flex h-10 items-center gap-1.5 rounded-input border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink hover:bg-surface-muted"
              >
                <Icon name="open_in_new" className="text-[17px] text-brand-800" />
                Ver mi perfil público
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {provider && provider.status !== "active" ? (
        <p className="flex items-start gap-2.5 rounded-card border border-accent bg-accent-soft p-4 text-[14px] leading-relaxed text-accent-ink">
          <Icon name="visibility_off" className="mt-0.5 text-[18px]" />
          Tu perfil todavía no es visible en el sitio. Cuando esté listo, tocá
          «Publicar perfil».
        </p>
      ) : null}

      <PlanBanner plan={plan} />

      <ProfileForm provider={provider} plan={plan} />
    </div>
  );
}

/**
 * Plan vigente y qué incluye (RF-053).
 *
 * Se muestra siempre, también en Cobre: saber qué tope tenés es parte de
 * entender por qué el formulario limita, y evita que el límite aparezca como
 * un error sin explicación.
 */
function PlanBanner({ plan }: { plan: PlanLimits }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-line bg-white px-5 py-3.5">
      <span className="flex items-center gap-2">
        <Icon name="workspace_premium" className="text-[19px] text-brand-800" />
        <span className="text-[14.5px] font-bold text-ink">
          Plan {plan.name}
        </span>
        <span className="text-[13px] text-ink-faint">{formatPrice(plan)}</span>
      </span>

      <span className="text-[13px] text-ink-soft">
        {plan.maxServices} servicios · {plan.maxServiceAreas} zonas
        {plan.maxGalleryImages > 0
          ? ` · ${plan.maxGalleryImages} imágenes`
          : ""}
      </span>

      <Link
        href="/planes"
        className="ml-auto text-[13.5px] font-semibold text-brand-800 hover:underline"
      >
        {plan.id === "platinum" ? "Ver planes" : "Mejorar mi plan"}
      </Link>
    </div>
  );
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
