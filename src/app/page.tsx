import { HomeHero } from "@/components/home-hero";
import { ProfileCard } from "@/components/profile-card";
import { SectorGrid } from "@/components/sector-grid";
import {
  AdSlot,
  ButtonLink,
  Icon,
  PROVIDER_GRID,
  SectionHeading,
} from "@/components/ui";
import { SERVICE_SECTORS, SPECIALTIES, listSpecialties } from "@/data/taxonomy";
import { listFeatured, listTopRated } from "@/application/profiles";
import { HOME_SECTION_SIZE } from "@/types";

/**
 * Los destacados y los mejor puntuados salen de la base, que no existe durante
 * el build: la portada se arma por pedido. Además cambia sola al publicarse un
 * perfil o al sumarse una opinión, así que congelarla mostraría un recorte
 * viejo.
 */
export const dynamic = "force-dynamic";

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

  /*
   * Los destacados ya tienen su sección: repetirlos acá le sacaría el lugar a
   * un perfil que no aparece en ninguna otra parte. "Destacado" ahora es una
   * capacidad del plan (BR-006) y no una marca del perfil, así que se compara
   * contra la lista y no contra un campo suyo.
   */
  const featuredIds = new Set(featured.map((profile) => profile.id));
  const topRated = (await listTopRated())
    .filter((profile) => !featuredIds.has(profile.id))
    .slice(0, HOME_SECTION_SIZE);

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
          <div className={PROVIDER_GRID}>
            {featured.map((provider) => (
              <ProfileCard key={provider.id} profile={provider} />
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
              <ProfileCard key={provider.id} profile={provider} />
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
