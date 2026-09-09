import type { Metadata } from "next";
import Link from "next/link";

import { findProfileBySlug } from "@/application/profiles";
import { findPublicServiceCard } from "@/application/service-cards";
import { NotFoundPage } from "@/components/not-found-page";
import { Chip, Icon, RatingLine, SECONDARY_SURFACE } from "@/components/ui";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { locationLabelById } from "@/data/locations";
import { canShowPhone, canUseWhatsapp, phoneHref, whatsappHref } from "@/lib/contact";
import { SERVICE_TIER_LABELS, serviceCardDuration, serviceCardFacts, serviceCardPrice } from "@/lib/service-cards";
import { PAYMENT_METHOD_LABELS, SERVICE_MODE_LABELS } from "@/types";

type Params = { slug: string };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const card = await findPublicServiceCard(slug);
  if (!card) return { title: "Servicio no encontrado", robots: { index: false } };
  return {
    title: `${card.title} · ${card.providerName}`,
    description: card.description,
    alternates: { canonical: `/servicios/${card.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const card = await findPublicServiceCard(slug);
  if (!card) {
    return <NotFoundPage title="No encontramos esta carta de servicio" message="Puede que la oferta haya cambiado, se haya pausado o el enlace esté desactualizado." />;
  }
  const profile = await findProfileBySlug(card.providerSlug);
  if (!profile) {
    return <NotFoundPage title="Este servicio ya no está disponible" message="El perfil que lo ofrecía dejó de estar publicado." />;
  }
  const specialty = getSpecialty(card.specialtyId);
  const sector = sectorOfSpecialty(card.specialtyId);
  const showWhatsapp = canUseWhatsapp(profile);
  const showPhone = canShowPhone(profile);
  const message = `Hola ${profile.name}, te contacto desde QuienLoHace por “${card.title}”.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: card.title,
    description: card.description,
    provider: { "@type": profile.type === "business" ? "Organization" : "Person", name: profile.name, url: `/profesionales/${profile.slug}` },
    areaServed: profile.serviceAreaIds.map(locationLabelById),
    serviceType: specialty?.name,
    offers: card.priceKind === "quote" ? undefined : {
      "@type": "Offer",
      priceCurrency: "UYU",
      price: (card.priceMinCents ?? 0) / 100,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="shell py-6 sm:py-10">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-soft" aria-label="Navegación">
          <Link href="/buscar" className="hover:text-brand-800">Servicios</Link><Icon name="chevron_right" className="text-[15px]" />
          {specialty ? <span>{specialty.name}</span> : null}
        </nav>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="overflow-hidden rounded-card border border-line bg-white shadow-panel">
              <div className="relative aspect-[16/8] max-h-[480px] overflow-hidden bg-card-gradient">
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.imageUrl} alt={`Imagen de ${card.title}`} className="h-full w-full object-cover" />
                ) : (
                  <><div className="absolute inset-0 bg-hatch" /><Icon name={sector?.icon ?? profile.icon} className="absolute -bottom-12 right-[8%] text-[240px] leading-none text-white/[.14]" /></>
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#101F3C]/60 to-transparent" />
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 sm:bottom-5 sm:left-5">
                  {specialty ? <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-ink shadow-sm">{specialty.name}</span> : null}
                  <span className="rounded-full bg-[#F5EAFE] px-3 py-1.5 text-[12px] font-bold text-[#7D31B8]">{SERVICE_TIER_LABELS[card.tier]}</span>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <h1 className="text-[27px] font-extrabold leading-tight tracking-[-.6px] text-ink sm:text-[34px]">{card.title}</h1>
                <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-ink-muted">{card.description}</p>
              </div>
            </section>

            <section className="rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
              <h2 className="mb-4 text-[18px] font-bold text-ink">Detalles de la propuesta</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail icon="workspaces" label="Modalidad" value={SERVICE_MODE_LABELS[card.serviceMode]} />
                <Detail icon="schedule" label="Duración" value={serviceCardDuration(card) ?? "A coordinar"} />
                <Detail icon="payments" label="Forma de pago" value={card.paymentMethod ? PAYMENT_METHOD_LABELS[card.paymentMethod] : "A coordinar"} />
                <Detail icon="calendar_month" label="Disponibilidad" value={card.schedule || "A coordinar"} />
              </dl>
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20">
            <section className="rounded-card border border-brand-600/30 bg-white p-5 shadow-panel">
              <p className="text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">Precio de la propuesta</p>
              <p className="mt-1 text-[25px] font-extrabold tracking-[-.5px] text-brand-800">{serviceCardPrice(card)}</p>
              <div className="my-4 h-px bg-line-soft" />
              <div className="grid gap-2.5">
                {showWhatsapp ? <a href={whatsappHref(profile, message)} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-input bg-whatsapp px-4 text-[14px] font-bold text-white hover:bg-success"><Icon name="chat" className="text-[19px]" />Consultar por WhatsApp</a> : null}
                {showPhone ? <a href={phoneHref(profile)} className={`flex h-11 items-center justify-center gap-2 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE}`}><Icon name="call" className="text-[18px]" />Llamar</a> : null}
                {profile.contactEmail ? <a href={`mailto:${profile.contactEmail}?subject=${encodeURIComponent(card.title)}`} className={`flex h-11 items-center justify-center gap-2 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE}`}><Icon name="mail" className="text-[18px]" />Enviar correo</a> : null}
              </div>
            </section>

            <section className="rounded-card border border-line bg-white p-5 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-[.6px] text-ink-faint">Ofrecido por</p>
              <Link href={`/profesionales/${profile.slug}`} className="mt-2 flex items-center gap-3 rounded-input hover:bg-surface-muted">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-input bg-brand-100 text-[16px] font-extrabold text-brand-800">{profile.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
                <span className="min-w-0"><span className="flex items-center gap-1 text-[15px] font-bold text-ink">{profile.name}{card.providerVerified ? <Icon name="verified" filled className="text-[16px] text-success" /> : null}</span><span className="mt-1 block"><RatingLine rating={card.providerRating} reviewCount={card.providerReviewCount} /></span></span>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>{locationLabelById(card.providerLocationId)}</Chip>
                {serviceCardFacts(card).slice(0, 1).map((fact) => <Chip key={fact.icon}>{fact.label}</Chip>)}
              </div>
              <Link href={`/profesionales/${profile.slug}`} className="mt-4 block text-center text-[13.5px] font-semibold text-brand-800 hover:underline">Ver perfil completo</Link>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="flex gap-3 rounded-input border border-line-soft bg-surface-muted p-3.5"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-input bg-brand-100 text-brand-800"><Icon name={icon} className="text-[18px]" /></span><div><dt className="text-[11px] font-bold uppercase tracking-[.5px] text-ink-faint">{label}</dt><dd className="mt-0.5 text-[14px] font-medium text-ink-muted">{value}</dd></div></div>;
}
