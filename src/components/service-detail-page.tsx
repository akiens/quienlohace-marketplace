import type { Metadata } from "next";

import { findProfileBySlug } from "@/application/profiles";
import { findPublicServiceCard } from "@/application/service-cards";
import { NotFoundPage } from "@/components/not-found-page";
import { ServiceDetailContent } from "@/components/service-detail-content";
import { locationLabelById } from "@/data/locations";
import { getSpecialty } from "@/data/taxonomy";
import { serviceCardHref } from "@/lib/service-cards";
import { siteUrl } from "@/lib/site-url";

export async function serviceDetailMetadata(
  serviceSlug: string,
  providerSlug?: string,
): Promise<Metadata> {
  const card = await findPublicServiceCard(serviceSlug);
  if (!card || (providerSlug && card.providerSlug !== providerSlug)) {
    return { title: "Servicio no encontrado", robots: { index: false } };
  }
  return {
    title: `${card.title} · ${card.providerName}`,
    description: card.description,
    alternates: { canonical: serviceCardHref(card) },
    openGraph: {
      title: `${card.title} · ${card.providerName}`,
      description: card.description,
      images: card.imageUrl ? [card.imageUrl] : undefined,
    },
  };
}

export async function ServiceDetailPage({
  serviceSlug,
  providerSlug,
}: {
  serviceSlug: string;
  providerSlug: string;
}) {
  const card = await findPublicServiceCard(serviceSlug);
  if (!card || card.providerSlug !== providerSlug) {
    return (
      <NotFoundPage
        title="No encontramos esta carta de servicio"
        message="Puede que la oferta haya cambiado, se haya pausado o el enlace esté desactualizado."
      />
    );
  }

  const profile = await findProfileBySlug(card.providerSlug);
  if (!profile) {
    return (
      <NotFoundPage
        title="Este servicio ya no está disponible"
        message="El perfil que lo ofrecía dejó de estar publicado."
      />
    );
  }

  const specialty = getSpecialty(card.specialtyId);
  const baseUrl = siteUrl();
  const absolute = (path: string) =>
    path.startsWith("http") ? path : `${baseUrl}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: card.title,
    description: card.description,
    image: card.images.length
      ? card.images.map((image) => absolute(image.url))
      : undefined,
    url: absolute(serviceCardHref(card)),
    provider: {
      "@type": profile.type === "business" ? "Organization" : "Person",
      name: profile.name,
      url: absolute(`/profesionales/${profile.slug}`),
    },
    areaServed: profile.serviceAreaIds.map(locationLabelById),
    serviceType: specialty?.name,
    offers:
      card.priceKind === "quote"
        ? undefined
        : {
            "@type": "Offer",
            priceCurrency: "UYU",
            price: (card.priceMinCents ?? 0) / 100,
          },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServiceDetailContent card={card} profile={profile} />
    </>
  );
}
