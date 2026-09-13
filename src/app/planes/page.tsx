import type { Metadata } from "next";
import Image from "next/image";

import { PlanCta } from "@/components/plan-cta";
import { PlanRibbonName } from "@/components/plan-ribbon-name";
import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import {
  PLAN_BADGES,
  formatPrice,
} from "@/domain/plans";
import { D1PlanRepository } from "@/infrastructure/d1-plan-repository";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import type { PlanLimits } from "@/types";

export const metadata: Metadata = {
  title: "Planes y precios",
  description:
    "Compará los planes Cobre, Oro y Platino de QuienLoHace: límites, funcionalidades y precios.",
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
            El distintivo de verificación no se compra. Oro y Platino pueden
            solicitarlo, y lo otorgamos después de validar los datos.
          </Rule>
          <Rule>
            Los destacados rotan entre los perfiles Platino compatibles: la
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
  // Platino es el plan que se quiere destacar comercialmente.
  const highlighted = plan.id === "platinum";

  return (
    <article
      // El adelanto de planes en `/registro` enlaza a cada plan por su id.
      id={plan.id}
      className={`relative scroll-mt-24 flex flex-col gap-5 rounded-card border p-6 pt-[68px] ${
        highlighted
          ? "border-brand-800 bg-white shadow-[0_1px_3px_rgba(16,24,40,.08)]"
          : "border-line bg-white"
      }`}
    >
      {/*
        La insignia desborda la esquina para que se lea como un sello sobre la
        tarjeta y no como un icono más del encabezado.

        El desborde hacia la derecha se apoya en el padding de `.shell`, que en
        la última tarjeta de la grilla es lo único que queda antes del borde de
        la pantalla. Por eso el corrimiento lateral es de 2 unidades y no más:
        con `-right-4` la insignia de Platino se recortaba contra el viewport.
      */}
      <Image
        src={PLAN_BADGES[plan.id]}
        alt=""
        width={112}
        height={112}
        className={`pointer-events-none absolute -top-4 z-20 h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(16,24,40,.22)] sm:-top-6 sm:h-28 sm:w-28 ${
          // El dibujo de Cobre es más angosto que el de Oro y Platino y dentro
          // del mismo cuadro queda visualmente corrido hacia la izquierda. Se
          // lo acerca al borde para que los tres sellos se vean alineados.
          plan.id === "cobre" ? "-right-3.5" : "-right-2"
        }`}
      />
      <PlanRibbonName plan={plan} />

      {/* `pr-24` reserva el ancho del sello para que no tape el precio. */}
      <header className="pr-20 sm:pr-24">
        <p className="text-[24px] font-bold tracking-[-.5px] text-ink">
          {formatPrice(plan)}
        </p>
      </header>

      <ul className="flex flex-col gap-2.5">
        <Feature>Perfil público en el marketplace</Feature>
        <Feature>{cap(plan.maxServiceSectors, "rubro", "rubros")}</Feature>
        <Feature>
          {cap(plan.maxSpecialties, "especialidad", "especialidades")}
        </Feature>
        <Feature>{cap(plan.maxServices, "servicio", "servicios")}</Feature>
        <Feature>{cap(plan.maxServiceCards, "carta de servicio", "cartas de servicio")}</Feature>
        <Feature>
          {cap(plan.maxLocations, "ubicación física", "ubicaciones físicas")}
        </Feature>
        <Feature>Zonas de trabajo sin límite</Feature>
        <Feature>Teléfono con WhatsApp y correo de contacto</Feature>
        <Feature>Foto de perfil, portada, horarios y medios de pago</Feature>

        {/*
          `0` es "no incluida" y `null` sería "sin límite": son cosas distintas
          (TR-002), así que la galería se apaga sólo con el 0.
        */}
        <Feature enabled={plan.maxGalleryImages !== 0}>
          {plan.maxGalleryImages === 0
            ? "Galería de trabajos"
            : cap(plan.maxGalleryImages, "imagen en galería", "imágenes en galería")}
        </Feature>
        <Feature enabled={plan.allowsSocialLinks}>Redes sociales</Feature>
        <Feature enabled={plan.allowsVerificationRequest}>
          Solicitud de verificación del perfil
        </Feature>
        <Feature enabled={plan.allowsContactForm}>
          Formulario de contacto
        </Feature>
        <Feature enabled={plan.allowsCustomLanding}>
          Landing page personalizada
        </Feature>
        <Feature enabled={plan.allowsSubdomain}>Subdominio propio</Feature>
        <Feature>
          Métricas{" "}
          {plan.metricsLevel === "advanced"
            ? "avanzadas"
            : plan.metricsLevel === "intermediate"
              ? "intermedias"
              : "básicas"}
        </Feature>
      </ul>

      {/*
        Elegir acá deja el plan elegido para el alta: se llega al registro con
        éste ya marcado, en vez de tener que volver a elegirlo.
      */}
      <PlanCta
        planId={plan.id}
        className={`mt-auto flex h-11 items-center justify-center rounded-input text-[14.5px] font-semibold transition-colors ${
          highlighted
            ? "bg-brand-800 text-white hover:bg-brand-900"
            : SECONDARY_SURFACE
        }`}
      >
        {plan.priceCents === 0 ? "Crear mi perfil" : `Elegir ${plan.name}`}
      </PlanCta>

      {plan.allowsCustomLanding ? (
        <p className="text-[12.5px] leading-relaxed text-ink-faint">
          La landing page se habilitará cuando el módulo esté disponible.
        </p>
      ) : null}
    </article>
  );
}

/** `enabled` en false marca lo que el plan no incluye, sin ocultarlo. */
/**
 * Cómo se lee un tope del plan. `null` es "sin límite comercial" y no un
 * número grande (TR-002), así que se dice con palabras en vez de mostrar un
 * vacío o un cero engañoso.
 */
function cap(limit: number | null, singular: string, plural: string): string {
  if (limit === null) return `${plural.charAt(0).toUpperCase()}${plural.slice(1)} sin límite`;
  return `Hasta ${limit} ${limit === 1 ? singular : plural}`;
}

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
