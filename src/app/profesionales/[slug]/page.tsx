import type { Metadata } from "next";
import Link from "next/link";

import {
  findProfileBySlug,
  findSimilarProfiles,
  findVisibleProfileBySlug,
  listReviews,
} from "@/application/profiles";
import { listProfileServiceCards } from "@/application/service-cards";
import { Banner } from "@/components/banner";
import { NotFoundPage } from "@/components/not-found-page";
import { PublicProfileGallery } from "@/components/public-profile-gallery";
import { ReviewForm } from "@/components/review-form";
import { ReviewList } from "@/components/review-list";
import { ServiceOfferCard } from "@/components/service-offer-card";
import {
  Chip,
  Icon,
  RatingLine,
  SECONDARY_SURFACE,
  VerifiedBadge,
} from "@/components/ui";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { locationLabelById } from "@/data/locations";
import {
  canShowPhone,
  canUseWhatsapp,
  phoneHref,
  whatsappHref,
} from "@/lib/contact";
import { getCurrentUser } from "@/lib/session";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type Profile,
  type SocialPlatform,
  type Specialty,
} from "@/types";

type Params = { slug: string };

/** La vista depende de la sesión porque el dueño puede previsualizar un borrador. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await findProfileBySlug(slug);
  if (!profile || profile.profileStatus !== "active") {
    return { title: "Perfil no encontrado", robots: { index: false } };
  }

  const where = profile.locations.find((item) => item.isPrimary && item.isActive)?.locationId
    ?? profile.serviceAreaIds[0]
    ?? "uruguay";

  return {
    title: `${profile.name} · ${locationLabelById(where)}`,
    description: profile.description,
    alternates: { canonical: `/profesionales/${profile.slug}` },
  };
}

export default async function ProviderPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const visible = await findVisibleProfileBySlug(slug, user?.id ?? null);

  if (!visible) {
    return (
      <NotFoundPage
        title="No existe un perfil público para un proveedor con este nombre"
        message="Puede que el enlace esté desactualizado, que el nombre esté escrito distinto o que ese perfil todavía no se haya publicado."
        suggestions={await findSimilarProfiles(slug)}
      />
    );
  }

  const { profile, isPreview } = visible;
  const avatar = profile.images.find((image) => image.kind === "avatar") ?? null;
  const cover = profile.images.find((image) => image.kind === "cover") ?? null;
  const gallery = profile.images.filter((image) => image.kind === "gallery");
  const [reviews, serviceCards] = await Promise.all([
    listReviews(profile.id),
    listProfileServiceCards(profile.id, isPreview),
  ]);

  const specialties = profile.specialtyIds
    .map(getSpecialty)
    .filter((item): item is Specialty => item !== undefined);
  const sectors = [...new Map(
    specialties
      .map((specialty) => sectorOfSpecialty(specialty.id))
      .filter((sector) => sector !== undefined)
      .map((sector) => [sector.id, sector] as const),
  ).values()];
  const activeServices = profile.services.filter((service) => service.isActive);
  const serviceGroups = specialties
    .map((specialty) => ({
      specialty,
      sector: sectorOfSpecialty(specialty.id),
      services: activeServices.filter((service) => service.specialtyId === specialty.id),
    }))
    .filter((group) => group.services.length > 0);
  const groupedIds = new Set(serviceGroups.flatMap((group) => group.services.map((service) => service.id)));
  const ungroupedServices = activeServices.filter((service) => !groupedIds.has(service.id));
  const serviceGroupCount = serviceGroups.length + (ungroupedServices.length > 0 ? 1 : 0);

  const primaryLocation = profile.locations.find((item) => item.isPrimary && item.isActive);
  const activeLocations = profile.locations.filter((item) => item.isActive);
  const location = locationLabelById(primaryLocation?.locationId ?? profile.serviceAreaIds[0] ?? "uruguay");
  const showPhone = canShowPhone(profile);
  const showWhatsapp = canUseWhatsapp(profile);
  const socialLinks = profile.socialLinks.filter((link) => link.isActive);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": profile.type === "business" ? "LocalBusiness" : "ProfessionalService",
    name: profile.name,
    description: profile.description,
    ...(profile.contactEmail ? { email: profile.contactEmail } : {}),
    ...(showPhone ? { telephone: profile.phoneE164 } : {}),
    areaServed: profile.serviceAreaIds.map(locationLabelById),
    sameAs: socialLinks.map((link) => link.url),
    knowsAbout: specialties.map((specialty) => specialty.name),
    ...(profile.rating !== null && profile.reviewCount > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: profile.rating,
        reviewCount: profile.reviewCount,
      },
    } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {isPreview ? (
        <Banner tone="info" icon="visibility_off">
          <strong className="font-semibold">Vista previa: así se verá tu perfil cuando lo publiques.</strong>{" "}
          Todavía no es visible para nadie más.{" "}
          <Link href="/dashboard" className="font-semibold underline">Volver a mi perfil</Link>
        </Banner>
      ) : null}

      <section className="relative z-0 h-[190px] overflow-hidden bg-card-gradient sm:h-[270px] lg:h-[320px]">
        {cover ? (
          // `/media` ya entrega el archivo procesado desde R2.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-hatch" />
            <Icon name={profile.icon} className="pointer-events-none absolute -bottom-9 right-[8%] text-[220px] leading-none text-white/[.1] sm:text-[280px]" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#101F3C]/70 via-[#101F3C]/10 to-transparent" />
      </section>

      <div className="shell relative z-10 pb-14 sm:pb-16">
        <section className="-mt-16 rounded-card border border-line bg-white p-4 shadow-panel sm:-mt-20 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <ProfileAvatar profile={profile} avatarUrl={avatar?.url} />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {profile.verificationStatus === "verified" ? <VerifiedBadge /> : null}
                <Chip>{profile.type === "business" ? "Empresa o equipo" : "Profesional independiente"}</Chip>
                {sectors.map((sector) => <Chip key={sector.id}>{sector.short}</Chip>)}
              </div>

              <div>
                <h1 className="break-words text-[27px] font-extrabold leading-tight tracking-[-.6px] text-ink sm:text-[34px]">{profile.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <RatingLine rating={profile.rating} reviewCount={profile.reviewCount} className="font-medium" />
                  <span className="flex items-center gap-1.5 text-[14px] text-ink-soft">
                    <Icon name="location_on" className="text-[18px] text-brand-700" />
                    {location}
                  </span>
                </div>
              </div>

              {specialties.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {specialties.map((specialty) => {
                    const sector = sectorOfSpecialty(specialty.id);
                    return sector ? (
                      <Link key={specialty.id} href={`/categorias/${sector.slug}/${specialty.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-[13px] font-semibold text-brand-800 transition-colors hover:bg-[#E1E7F1]">
                        <Icon name={sector.icon} className="text-[16px]" />
                        {specialty.name}
                      </Link>
                    ) : <Chip key={specialty.id}>{specialty.name}</Chip>;
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-line-soft pt-5 lg:hidden">
            <ContactActions profile={profile} showWhatsapp={showWhatsapp} showPhone={showPhone} />
          </div>
        </section>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
            <ProfilePanel title="Sobre este perfil" icon="person">
              <p className="whitespace-pre-line text-[15px] leading-7 text-ink-muted">{profile.description}</p>
            </ProfilePanel>

            {serviceCards.length > 0 ? (
              <ProfilePanel
                title="Propuestas de servicio"
                icon="sell"
                subtitle={`${serviceCards.length} ${serviceCards.length === 1 ? "opción lista para contratar" : "opciones listas para contratar"}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {serviceCards.map((card) => <ServiceOfferCard key={card.id} card={card} />)}
                </div>
              </ProfilePanel>
            ) : null}

            {activeServices.length > 0 ? (
              <ProfilePanel title="Servicios" icon="handyman" subtitle={`${activeServices.length} ${activeServices.length === 1 ? "servicio disponible" : "servicios disponibles"}`}>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                  {serviceGroups.map(({ specialty, sector, services }) => (
                    <ServiceGroup key={specialty.id} title={specialty.name} icon={sector?.icon ?? profile.icon} services={services} wide={serviceGroupCount === 1} />
                  ))}
                  {ungroupedServices.length > 0 ? <ServiceGroup title="Otros servicios" icon="task_alt" services={ungroupedServices} wide={serviceGroupCount === 1} /> : null}
                </div>
              </ProfilePanel>
            ) : null}

            {gallery.length > 0 ? (
              <ProfilePanel title="Trabajos y proyectos" icon="photo_library" subtitle={`${gallery.length} ${gallery.length === 1 ? "foto" : "fotos"}`}>
                <PublicProfileGallery images={gallery} />
              </ProfilePanel>
            ) : null}

            <ProfilePanel title="Opiniones" icon="reviews" subtitle={profile.reviewCount > 0 ? `${profile.reviewCount} ${profile.reviewCount === 1 ? "experiencia compartida" : "experiencias compartidas"}` : undefined}>
              <div className="flex flex-col gap-5">
                <ReviewList reviews={reviews} totalCount={profile.reviewCount} />
                <ReviewForm profileId={profile.id} providerSlug={profile.slug} />
              </div>
            </ProfilePanel>
          </div>

          <aside className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
            <div className="hidden lg:block">
              <ProfilePanel title="Contactar" icon="contact_phone" emphasized>
                <ContactActions profile={profile} showWhatsapp={showWhatsapp} showPhone={showPhone} />
              </ProfilePanel>
            </div>

            {profile.scheduleEntries.length > 0 ? (
              <ProfilePanel title="Horarios" icon="schedule">
                <ul className="flex flex-col divide-y divide-line-soft">
                  {profile.scheduleEntries.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                      <Icon name="schedule" className="mt-0.5 flex-none text-[16px] text-brand-700" />
                      <span className="text-[14px] leading-relaxed text-ink-muted">{entry.text}</span>
                    </li>
                  ))}
                </ul>
              </ProfilePanel>
            ) : null}

            {(profile.serviceModes.length > 0 || profile.serviceAreaIds.length > 0 || profile.paymentMethods.length > 0) ? (
              <ProfilePanel title="Cómo trabaja" icon="handshake">
                <div className="flex flex-col gap-5">
                  {profile.serviceModes.length > 0 ? (
                    <InfoBlock label="Modalidad">
                      <div className="flex flex-wrap gap-1.5">
                        {profile.serviceModes.map((mode) => <Chip key={mode}>{SERVICE_MODE_LABELS[mode]}</Chip>)}
                      </div>
                    </InfoBlock>
                  ) : null}
                  {profile.serviceAreaIds.length > 0 ? (
                    <InfoBlock label="Zonas de cobertura">
                      <div className="flex flex-wrap gap-1.5">
                        {profile.serviceAreaIds.map((id) => <Chip key={id}>{locationLabelById(id)}</Chip>)}
                      </div>
                    </InfoBlock>
                  ) : null}
                  {profile.paymentMethods.length > 0 ? (
                    <InfoBlock label="Formas de pago">
                      <ul className="grid grid-cols-2 gap-2">
                        {profile.paymentMethods.map((method) => (
                          <li key={method} className="flex items-center gap-1.5 text-[13.5px] text-ink-muted">
                            <Icon name="check" className="text-[15px] text-success" />
                            {PAYMENT_METHOD_LABELS[method]}
                          </li>
                        ))}
                      </ul>
                    </InfoBlock>
                  ) : null}
                </div>
              </ProfilePanel>
            ) : null}

            {activeLocations.length > 0 ? (
              <ProfilePanel title={activeLocations.length === 1 ? "Ubicación" : "Ubicaciones"} icon="location_on">
                <ul className="flex flex-col gap-3">
                  {activeLocations.map((item) => (
                    <li key={item.id} className="rounded-input border border-line-soft bg-surface-muted p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{item.name || locationLabelById(item.locationId)}</span>
                        {item.isPrimary && activeLocations.length > 1 ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-800">Principal</span> : null}
                      </div>
                      {item.address ? <p className="mt-1 break-words text-[13.5px] text-ink-muted">{item.address}</p> : null}
                      {item.name || item.address ? <p className="mt-1 text-[12.5px] text-ink-faint">{locationLabelById(item.locationId)}</p> : null}
                    </li>
                  ))}
                </ul>
              </ProfilePanel>
            ) : null}

            {socialLinks.length > 0 ? (
              <ProfilePanel title="Enlaces y redes" icon="share">
                <div className="grid grid-cols-2 gap-2">
                  {socialLinks.map((link) => {
                    const meta = SOCIAL_META[link.platform];
                    return (
                      <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex min-w-0 items-center gap-2 rounded-input px-3 py-2.5 text-[13px] font-semibold ${SECONDARY_SURFACE}`}>
                        <Icon name={meta.icon} className="flex-none text-[17px]" />
                        <span className="truncate">{meta.label}</span>
                      </a>
                    );
                  })}
                </div>
              </ProfilePanel>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}

function ProfileAvatar({ profile, avatarUrl }: { profile: Profile; avatarUrl?: string }) {
  const initials = profile.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt={`Foto de ${profile.name}`} className="h-[88px] w-[88px] flex-none rounded-[22px] border-4 border-white object-cover shadow-card sm:h-[108px] sm:w-[108px]" />
  ) : (
    <span className="flex h-[88px] w-[88px] flex-none items-center justify-center rounded-[22px] border-4 border-white bg-brand-100 text-[25px] font-extrabold text-brand-800 shadow-card sm:h-[108px] sm:w-[108px]">{initials}</span>
  );
}

function ContactActions({ profile, showWhatsapp, showPhone }: { profile: Profile; showWhatsapp: boolean; showPhone: boolean }) {
  if (!showWhatsapp && !showPhone && !profile.contactEmail) {
    return <p className="text-[14px] leading-relaxed text-ink-soft">Este perfil todavía no publicó canales de contacto.</p>;
  }
  return (
    <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
      {showWhatsapp ? <a href={whatsappHref(profile)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-input bg-whatsapp px-4 py-2.5 text-center text-[14px] font-bold text-white transition-colors hover:bg-success"><Icon name="chat" className="text-[19px]" />Escribir por WhatsApp</a> : null}
      {showPhone ? <a href={phoneHref(profile)} className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-input px-4 py-2.5 text-center text-[14px] font-semibold ${SECONDARY_SURFACE}`}><Icon name="call" className="flex-none text-[18px]" /><span className="truncate">{profile.phone}</span></a> : null}
      {profile.contactEmail ? <a href={`mailto:${profile.contactEmail}`} className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-input px-4 py-2.5 text-center text-[14px] font-semibold sm:col-span-2 lg:col-span-1 ${SECONDARY_SURFACE}`}><Icon name="mail" className="flex-none text-[18px]" /><span className="truncate">{profile.contactEmail}</span></a> : null}
    </div>
  );
}

function ServiceGroup({ title, icon, services, wide = false }: { title: string; icon: string; services: Profile["services"]; wide?: boolean }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-input border border-line-soft bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100 text-brand-800"><Icon name={icon} className="text-[17px]" /></span>
        <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      </div>
      <ul className={`grid gap-2 ${wide ? "sm:grid-cols-2 xl:grid-cols-3" : ""}`}>
        {services.map((service) => <li key={service.id} className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-muted"><Icon name="check_circle" filled className="mt-0.5 flex-none text-[16px] text-success" />{service.name}</li>)}
      </ul>
    </article>
  );
}

function ProfilePanel({ title, icon, subtitle, emphasized = false, children }: { title: string; icon: string; subtitle?: string; emphasized?: boolean; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-card border bg-white p-4 shadow-card sm:p-5 ${emphasized ? "border-brand-600/35" : "border-line"}`}>
      <header className="mb-4 flex items-center gap-3 border-b border-line-soft pb-3.5">
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-input ${emphasized ? "bg-brand-800 text-white" : "bg-brand-100 text-brand-800"}`}><Icon name={icon} className="text-[19px]" /></span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-.2px] text-ink">{title}</h2>
          {subtitle ? <p className="text-[12.5px] text-ink-faint">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[11px] font-bold uppercase tracking-[.55px] text-ink-faint">{label}</h3>{children}</div>;
}

const SOCIAL_META: Record<SocialPlatform, { label: string; icon: string }> = {
  instagram: { label: "Instagram", icon: "photo_camera" },
  facebook: { label: "Facebook", icon: "groups" },
  linkedin: { label: "LinkedIn", icon: "work" },
  x: { label: "X", icon: "alternate_email" },
  tiktok: { label: "TikTok", icon: "music_note" },
  youtube: { label: "YouTube", icon: "smart_display" },
  website: { label: "Sitio web", icon: "language" },
};
