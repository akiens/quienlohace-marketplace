import Link from "next/link";

import { HomeHero } from "@/components/home-hero";
import { ProviderCard } from "@/components/provider-card";
import {
  AdSlot,
  ButtonLink,
  Icon,
  PROVIDER_GRID,
  SectionHeading,
} from "@/components/ui";
import { CATEGORIES } from "@/data/categories";
import { listFeatured, listTopRated } from "@/application/providers";
import { HOME_SECTION_SIZE } from "@/types";

const STEPS = [
  {
    icon: "search",
    title: "Buscá lo que necesitás",
    body: "Elegí el rubro y la zona. No hace falta crear una cuenta ni dejar tus datos.",
  },
  {
    icon: "compare_arrows",
    title: "Compará perfiles",
    body: "Mirá servicios, opiniones, zonas de trabajo y formas de pago antes de decidir.",
  },
  {
    icon: "chat",
    title: "Contactá directo",
    body: "Escribís por WhatsApp o llamás al profesional. Sin intermediarios ni comisiones.",
  },
];

export default async function HomePage() {
  const featured = (await listFeatured()).slice(0, HOME_SECTION_SIZE);
  const topRated = (await listTopRated())
    .filter((provider) => !provider.featured)
    .slice(0, HOME_SECTION_SIZE);

  return (
    <>
      <HomeHero />

      <div className="shell flex flex-col gap-14 py-12">
        {/* Categorías: la puerta de entrada a la navegación y al SEO. */}
        <section>
          <SectionHeading
            title="Explorá por categoría"
            subtitle="20 rubros con profesionales y empresas en todo el país."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/categorias/${category.slug}`}
                className="group flex flex-col gap-2.5 rounded-card border border-line bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#C6CEDC] hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-100">
                  <Icon name={category.icon} className="text-[21px] text-brand-800" />
                </span>
                <span className="text-[14.5px] font-semibold leading-tight text-ink">
                  {category.short}
                </span>
                <span className="text-[12.5px] text-ink-soft">
                  {category.providerCount} profesionales
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title="Profesionales destacados"
            subtitle="Perfiles con mayor visibilidad contratada."
            action={
              <ButtonLink href="/destacados" variant="secondary" size="sm">
                Ver todos
              </ButtonLink>
            }
          />
          <div className={PROVIDER_GRID}>
            {featured.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </section>

        {/* Cómo funciona: resuelve la objeción principal antes de pedir nada. */}
        <section className="rounded-card border border-line bg-white p-6 lg:p-9">
          <SectionHeading
            title="Cómo funciona"
            subtitle="Tres pasos, sin registro y sin costo para quien busca."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-900">
                  <Icon name={step.icon} className="text-[22px] text-accent" />
                </span>
                <h3 className="text-[16px] font-bold text-ink">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title="Mejor calificados"
            subtitle="Los perfiles con mejores opiniones de la comunidad."
            action={
              <ButtonLink href="/buscar" variant="secondary" size="sm">
                Ver más
              </ButtonLink>
            }
          />
          <div className={PROVIDER_GRID}>
            {topRated.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </section>

        <AdSlot />

        {/* Llamada a la oferta: el otro lado del marketplace. */}
        <section className="overflow-hidden rounded-card bg-brand-gradient">
          <div className="relative flex flex-col items-start gap-4 p-8 lg:p-12">
            <div className="pointer-events-none absolute inset-0 bg-hatch" />
            <div className="relative flex flex-col gap-2.5">
              <h2 className="max-w-2xl text-[24px] font-extrabold leading-tight tracking-[-.5px] text-white lg:text-[30px]">
                ¿Ofrecés un servicio? Publicá tu perfil gratis
              </h2>
              <p className="max-w-xl text-[15px] leading-relaxed text-[#C3CEE2]">
                Creá tu perfil, elegí tus servicios y las zonas donde trabajás.
                Recibí contactos por WhatsApp directo, sin comisiones por trabajo.
              </p>
            </div>
            <ButtonLink href="/registro" variant="accent" className="relative">
              Publicar mi perfil
              <Icon name="arrow_forward" className="text-[18px]" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </>
  );
}
