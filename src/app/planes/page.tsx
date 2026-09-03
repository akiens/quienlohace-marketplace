import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import {
  PLAN_BADGES,
  PLAN_RIBBONS,
  PLAN_TIERS,
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
        href="/registro"
        className={`mt-auto flex h-11 items-center justify-center rounded-input text-[14.5px] font-semibold transition-colors ${
          highlighted
            ? "bg-brand-800 text-white hover:bg-brand-900"
            : SECONDARY_SURFACE
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

/**
 * Banderín con el nombre del plan.
 *
 * Sale del borde izquierdo de la tarjeta y baja un pliegue por detrás, para
 * que se lea como una cinta que envuelve la tarjeta. Por la derecha termina
 * al ras: la última tarjeta de la grilla queda contra el padding de `.shell`
 * y un desborde de ese lado se recortaría contra el viewport.
 */
function PlanRibbonName({ plan }: { plan: PlanLimits }) {
  const ribbon = PLAN_RIBBONS[plan.id];

  return (
    // `-left-3` es el desborde, que el contenedor no recorta. Por la derecha
    // llega al ras del borde (`right-0`): ahí no desborda, porque la última
    // tarjeta de la grilla ya está contra el padding de `.shell`. El sello
    // tiene un z-index mayor, así que le pasa por encima al banderín.
    <div className="pointer-events-none absolute -left-3 right-0 top-5 z-10">
      {/*
        El pliegue: un triángulo bajo el extremo izquierdo que simula la cara
        posterior de la cinta doblada. Va detrás del frente (`-z-10`) y pegado
        a su base para que parezca el mismo trozo de tela.
      */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-full -z-10 h-3 w-3"
        style={{
          background: ribbon.fold,
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
        }}
      />

      {/*
        El texto es blanco en los tres planes: el degradado arranca oscuro por
        izquierda justamente para que así sea. La sombra combina una línea
        oscura abajo y una clara arriba, que es lo que da el efecto de letra
        grabada en la cinta.
      */}
      <h2
        className="flex min-h-[34px] items-center gap-2.5 rounded-r-sm py-1.5 pl-4 pr-5 text-[17px] font-bold tracking-[.2px] text-white shadow-[0_2px_6px_rgba(16,24,40,.18)] [text-shadow:0_1px_1px_rgba(0,0,0,.55),0_-1px_0_rgba(255,255,255,.18)]"
        style={{ background: ribbon.face }}
      >
        {plan.name}
        {/*
          La pastilla oscurece en vez de aclarar: sobre el degradado de Oro,
          que es el más claro de los tres, un velo blanco dejaba el texto en
          4.3:1. Con el velo oscuro los tres superan 4.5:1.
        */}
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white [text-shadow:none]">
          {PLAN_TIERS[plan.id]}
        </span>
      </h2>
    </div>
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
