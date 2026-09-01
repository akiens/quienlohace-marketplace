import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui";
import { formatPrice } from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import type { PlanLimits } from "@/types";

export const metadata: Metadata = {
  title: "Planes y precios",
  description:
    "Compará los planes Cobre, Gold y Platinum de QuienLoHace: límites, funcionalidades y precios.",
  alternates: { canonical: "/planes" },
};

/**
 * Los precios salen de la base y pueden cambiar sin desplegar (RF-096), así
 * que la página se revalida en vez de congelarse en el build.
 */
export const revalidate = 3600;

/** Comparación pública de planes (RF-053). */
export default async function PlansPage() {
  const plans = hasCloudflareRuntime()
    ? await new D1PlanRepository().list()
    : [];

  return (
    <div className="shell flex flex-col gap-10 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[30px] font-bold tracking-[-.6px] text-ink sm:text-[36px]">
          Planes para profesionales
        </h1>
        <p className="max-w-2xl text-[15.5px] leading-relaxed text-ink-soft">
          Buscar y contactar siempre es gratis para quien necesita un servicio.
          Estos planes son para quienes ofrecen uno y quieren más visibilidad.
        </p>
      </header>

      {plans.length === 0 ? (
        <p className="rounded-card border border-line bg-white p-6 text-center text-[14.5px] text-ink-soft">
          Los planes no están disponibles en este momento.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-6">
        <h2 className="text-[17px] font-bold text-ink">
          Cómo funcionan los límites
        </h2>
        <ul className="flex flex-col gap-2.5 text-[14.5px] leading-relaxed text-ink-muted">
          <Rule>
            Si bajás de plan no perdés información: se conserva todo y elegís
            qué queda publicado.
          </Rule>
          <Rule>
            El distintivo de verificación no se compra. Gold y Platinum pueden
            solicitarlo, y lo otorgamos después de validar los datos.
          </Rule>
          <Rule>
            Los destacados rotan entre los perfiles Platinum compatibles: la
            posición no es fija ni permanente.
          </Rule>
          <Rule>
            Los resultados patrocinados se identifican siempre como tales y no
            reemplazan a los resultados más relevantes.
          </Rule>
        </ul>
      </section>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanLimits }) {
  // Platinum es el plan que se quiere destacar comercialmente.
  const highlighted = plan.id === "platinum";

  return (
    <article
      className={`flex flex-col gap-5 rounded-card border p-6 ${
        highlighted
          ? "border-brand-800 bg-white shadow-[0_1px_3px_rgba(16,24,40,.08)]"
          : "border-line bg-white"
      }`}
    >
      <header className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <h2 className="text-[19px] font-bold text-ink">{plan.name}</h2>
          {highlighted ? (
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-brand-800">
              Completo
            </span>
          ) : null}
        </span>
        <p className="text-[24px] font-bold tracking-[-.5px] text-ink">
          {formatPrice(plan)}
        </p>
      </header>

      <ul className="flex flex-col gap-2.5">
        <Feature>Perfil público en el marketplace</Feature>
        <Feature>Hasta {plan.maxServices} servicios</Feature>
        <Feature>Hasta {plan.maxSubcategories} subcategorías</Feature>
        <Feature>Hasta {plan.maxServiceAreas} zonas de trabajo</Feature>
        <Feature>Teléfono, WhatsApp y email público</Feature>

        <Feature enabled={plan.maxGalleryImages > 0}>
          {plan.maxGalleryImages > 0
            ? `Galería de ${plan.maxGalleryImages} imágenes`
            : "Galería de trabajos"}
        </Feature>
        <Feature enabled={plan.allowsSocialLinks}>Redes sociales</Feature>
        <Feature enabled={plan.allowsVerificationRequest}>
          Solicitud de verificación
        </Feature>
        <Feature enabled={plan.allowsFeatured}>Posiciones destacadas</Feature>
        <Feature enabled={plan.allowsContactForm}>
          Formulario de contacto
        </Feature>
        <Feature enabled={plan.allowsLanding}>
          Landing page y subdominio propio
        </Feature>
        <Feature enabled={plan.maxTeamMembers > 0}>
          {plan.maxTeamMembers > 0
            ? `Equipo de hasta ${plan.maxTeamMembers} integrantes`
            : "Integrantes del equipo"}
        </Feature>
        <Feature>
          Métricas{" "}
          {plan.metricsLevel === "full"
            ? "completas"
            : plan.metricsLevel === "intermediate"
              ? "intermedias"
              : "básicas"}
        </Feature>
      </ul>

      <Link
        href="/entrar?perfil=1"
        className={`mt-auto flex h-11 items-center justify-center rounded-input text-[14.5px] font-semibold transition-colors ${
          highlighted
            ? "bg-brand-800 text-white hover:bg-brand-900"
            : "border border-line-strong bg-white text-ink hover:bg-surface-muted"
        }`}
      >
        {plan.priceCents === 0 ? "Crear mi perfil" : `Elegir ${plan.name}`}
      </Link>

      {plan.allowsLanding ? (
        <p className="text-[12.5px] leading-relaxed text-ink-faint">
          La landing page se habilitará cuando el módulo esté disponible.
        </p>
      ) : null}
    </article>
  );
}

/** `enabled` en false marca lo que el plan no incluye, sin ocultarlo. */
function Feature({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2 text-[14px] leading-relaxed ${
        enabled ? "text-ink-muted" : "text-ink-faint line-through"
      }`}
    >
      <Icon
        name={enabled ? "check_circle" : "remove"}
        filled={enabled}
        className={`mt-0.5 text-[17px] ${
          enabled ? "text-[#1E8C56]" : "text-[#C6CEDC]"
        }`}
      />
      {children}
    </li>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon name="info" className="mt-0.5 text-[17px] text-brand-800" />
      {children}
    </li>
  );
}
