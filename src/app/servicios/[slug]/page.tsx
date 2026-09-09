import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { findPublicServiceCard } from "@/application/service-cards";
import { serviceDetailMetadata } from "@/components/service-detail-page";
import { NotFoundPage } from "@/components/not-found-page";
import { serviceCardHref } from "@/lib/service-cards";

type Params = { slug: string };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return serviceDetailMetadata(slug);
}

/** Conserva enlaces antiguos, pero concentra el SEO en la URL del proveedor. */
export default async function LegacyServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const card = await findPublicServiceCard(slug);
  if (!card) {
    return <NotFoundPage title="No encontramos esta carta de servicio" message="Puede que la oferta haya cambiado, se haya pausado o el enlace esté desactualizado." />;
  }
  permanentRedirect(serviceCardHref(card));
}
