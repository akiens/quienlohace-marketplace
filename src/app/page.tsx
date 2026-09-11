import { HomeHero } from "@/components/home-hero";
import { ProfileGrid } from "@/components/profile-grid";
import { SectorGrid } from "@/components/sector-grid";
import { TrialBanner } from "@/components/trial-banner";
import {
  AdSlot,
  ButtonLink,
  Icon,
  SectionHeading,
} from "@/components/ui";
import { SERVICE_SECTORS, SPECIALTIES, listSpecialties } from "@/data/taxonomy";
import { getPreparedHomeSections } from "@/application/showcase";

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

export default function HomePage() {
  const { featured, topRated } = getPreparedHomeSections();

  /*
   * Las tarjetas de rubro, ya contadas.
   *
   * La grilla es un componente de cliente —se pliega y despliega—, así que
   * recibe lo justo: sin esto habría que mandarle la taxonomía entera al
   * navegador para contar especialidades que no cambian nunca.
   */
  const sectorCards = SERVICE_SECTORS.map((sector) => ({
    id: sector.id,
    slug: sector.slug,
    short: sector.short,
    icon: sector.icon,
    specialtyCount: listSpecialties(sector.id).length,
  }));

  return (
    <>
      <HomeHero />

      <div className="shell flex flex-col gap-14 py-12">
        {/*
          Rubros: la puerta de entrada a la navegación y al SEO.

          El título dice "rubros y especialidades" y no "categoría" porque es
          como se llaman en todo el resto del producto —la taxonomía es rubro →
          especialidad → servicio (BR-010), y así lo dicen el alta, los planes y
          el subtítulo de acá al lado—. "Categoría" sobrevivía sólo en este
          encabezado, justo arriba de unas tarjetas que cuentan especialidades.
          La URL sigue siendo `/categorias/...`: cambiarla rompería enlaces ya
          publicados e indexados, y no es lo que se lee.
        */}
        <section>
          <SectionHeading
            title="Explorá por rubros y especialidades"
            subtitle={`Con más de ${SERVICE_SECTORS.length} rubros y ${SPECIALTIES.length} especialidades.`}
          />
          <SectorGrid sectors={sectorCards} />
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
          <ProfileGrid profiles={featured} initialVisible={featured.length} />
        </section>
      </div>

      {/*
        Publicá tu perfil: la llamada al otro lado del marketplace.

        Va fuera del `shell` y no adentro: a lo ancho de la pantalla, sin el
        margen lateral que llevan las demás secciones, corta la lista de
        perfiles en dos y se lee como una franja y no como una tarjeta más.
        Por eso la portada son dos `shell` con esto en el medio, en lugar de
        uno solo con márgenes negativos acá.
      */}
      <section className="relative overflow-hidden bg-brand-gradient">
        <div className="pointer-events-none absolute inset-0 bg-hatch" />
        <div className="shell relative flex flex-col items-start gap-4 py-10 lg:py-14">
          <div className="flex flex-col gap-2.5">
            <h2 className="max-w-2xl text-[24px] font-extrabold leading-tight tracking-[-.5px] text-white lg:text-[30px]">
              ¿Ofrecés un servicio? Publicá tu perfil gratis
            </h2>
            <p className="max-w-xl text-[15px] leading-relaxed text-[#C3CEE2]">
              Creá tu perfil, elegí tus servicios y las zonas donde trabajás.
              Recibí contactos por WhatsApp directo, sin comisiones por trabajo.
            </p>
          </div>
          <ButtonLink href="/registro" variant="accent">
            Publicar mi perfil
            <Icon name="arrow_forward" className="text-[18px]" />
          </ButtonLink>
        </div>
      </section>

      <div className="shell flex flex-col gap-14 py-12">
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
          <ProfileGrid profiles={topRated} initialVisible={topRated.length} />
        </section>

        {/*
          El espacio publicitario. Sin anuncio que poner, lo ocupa la oferta de
          prueba en vez de quedar como un hueco rotulado "Publicidad".
        */}
        <AdSlot fallback={<TrialBanner />} />
      </div>

      {/*
        Cómo funciona, cerrando la portada.

        Va al final y no antes de los perfiles: quien llega ya sabe lo que
        quiere y va al buscador; esto es para el que bajó hasta el fondo sin
        decidirse, y ahí sí contesta la pregunta de qué pasa después de elegir
        a alguien.

        A lo ancho como el banner de arriba, pero en claro: dos franjas
        oscuras seguidas se leerían como un solo bloque y la portada terminaría
        en un muro. El fondo `surface-muted` la despega del blanco de la página
        sin volver a pedir la atención que pide el banner.
      */}
      <section className="border-t border-line bg-surface-muted">
        <div className="shell py-12 lg:py-16">
          <SectionHeading
            title="Cómo funciona"
            subtitle="Tres pasos, sin registro y sin costo para quien busca."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-8">
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
        </div>
      </section>
    </>
  );
}
