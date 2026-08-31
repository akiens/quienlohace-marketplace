import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ButtonLink, Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Qué es QuienLoHace, por qué lo hacemos y cómo pensamos el directorio de servicios de Uruguay.",
};

const PRINCIPLES = [
  {
    icon: "bolt",
    title: "Sin fricción",
    body: "Buscar, comparar y contactar no requiere cuenta. La identidad se pide sólo cuando aporta algo, como al dejar una opinión.",
  },
  {
    icon: "handshake",
    title: "Sin intermediación",
    body: "El trato es directo entre la persona y el profesional. No cobramos comisión por trabajo ni retenemos pagos.",
  },
  {
    icon: "visibility",
    title: "Publicidad transparente",
    body: "Todo espacio promocional está rotulado. Un resultado pago siempre se distingue de uno orgánico.",
  },
  {
    icon: "public",
    title: "Todo el país",
    body: "Los 19 departamentos, con sus localidades y barrios. No sólo Montevideo.",
  },
];

export default function AboutPage() {
  return (
    <div className="shell flex flex-col gap-10 py-8">
      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Sobre nosotros" }]}
      />

      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[32px]">
          Conectamos clientes y profesionales
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          En Uruguay, encontrar un buen electricista, una veterinaria de
          confianza o un contador sigue dependiendo del boca a boca. QuienLoHace
          nació para ordenar eso: un directorio donde cada profesional tiene un
          lugar propio y cada persona puede comparar antes de decidir.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <div
            key={principle.title}
            className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-100">
              <Icon name={principle.icon} className="text-[22px] text-brand-800" />
            </span>
            <h2 className="text-[17px] font-bold text-ink">{principle.title}</h2>
            <p className="text-[14.5px] leading-relaxed text-ink-soft">
              {principle.body}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-card bg-brand-gradient">
        <div className="relative flex flex-col items-start gap-4 p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-hatch" />
          <div className="relative flex flex-col gap-2">
            <h2 className="text-[22px] font-extrabold tracking-[-.4px] text-white sm:text-[26px]">
              ¿Querés que trabajemos juntos?
            </h2>
            <p className="max-w-xl text-[15px] leading-relaxed text-[#C3CEE2]">
              Si ofrecés un servicio, publicá tu perfil gratis. Si querés
              anunciar en QuienLoHace o proponernos algo, escribinos.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-2.5">
            <ButtonLink href="/entrar?perfil=1" variant="accent">
              Publicar mi perfil
            </ButtonLink>
            <ButtonLink
              href="/contacto"
              variant="secondary"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              Contactarnos
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
