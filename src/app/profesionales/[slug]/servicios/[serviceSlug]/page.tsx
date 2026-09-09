import type { Metadata } from "next";

import { ServiceDetailPage, serviceDetailMetadata } from "@/components/service-detail-page";

type Params = { slug: string; serviceSlug: string };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, serviceSlug } = await params;
  return serviceDetailMetadata(serviceSlug, slug);
}

export default async function ProviderServicePage({ params }: { params: Promise<Params> }) {
  const { slug, serviceSlug } = await params;
  return <ServiceDetailPage serviceSlug={serviceSlug} providerSlug={slug} />;
}
