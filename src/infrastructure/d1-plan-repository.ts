import "server-only";

import { getDb } from "@/infrastructure/cloudflare";
import type { PlanId, PlanLimits } from "@/types";

/**
 * Adapter D1 de los planes.
 *
 * Los límites y precios se leen de la base y no del código: TR-014 pide
 * leerlos de persistencia y no de condicionales dispersos. Como cambian muy poco y se consultan en
 * casi todas las páginas del panel, se cachean por request.
 */

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  period: string;
  rank: number;
  /** Los topes admiten NULL: es "sin límite comercial" (TR-002). */
  max_service_sectors: number | null;
  max_specialties: number | null;
  max_services: number | null;
  max_locations: number | null;
  max_gallery_images: number | null;
  max_service_cards: number;
  allows_social_links: number;
  allows_verification_request: number;
  allows_featured_placement: number;
  allows_contact_form: number;
  allows_custom_landing: number;
  allows_subdomain: number;
  metrics_level: string;
};

function toPlan(row: PlanRow): PlanLimits {
  return {
    id: row.id as PlanId,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency,
    period: row.period as PlanLimits["period"],
    rank: row.rank,
    maxServiceSectors: row.max_service_sectors,
    maxSpecialties: row.max_specialties,
    maxServices: row.max_services,
    maxLocations: row.max_locations,
    maxGalleryImages: row.max_gallery_images,
    maxServiceCards: row.max_service_cards,
    allowsSocialLinks: row.allows_social_links === 1,
    allowsVerificationRequest: row.allows_verification_request === 1,
    allowsFeaturedPlacement: row.allows_featured_placement === 1,
    allowsContactForm: row.allows_contact_form === 1,
    allowsCustomLanding: row.allows_custom_landing === 1,
    allowsSubdomain: row.allows_subdomain === 1,
    metricsLevel: row.metrics_level as PlanLimits["metricsLevel"],
  };
}

const COLUMNS = `id, name, price_cents, currency, period, rank,
  max_service_sectors, max_specialties, max_services, max_locations,
  max_gallery_images, max_service_cards, allows_social_links, allows_verification_request,
  allows_featured_placement, allows_contact_form, allows_custom_landing,
  allows_subdomain, metrics_level`;

export class D1PlanRepository {
  async list(): Promise<PlanLimits[]> {
    const { results } = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM plans ORDER BY rank`)
      .all<PlanRow>();
    return results.map(toPlan);
  }

  async findById(id: string): Promise<PlanLimits | null> {
    const row = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM plans WHERE id = ?`)
      .bind(id)
      .first<PlanRow>();
    return row ? toPlan(row) : null;
  }
}
