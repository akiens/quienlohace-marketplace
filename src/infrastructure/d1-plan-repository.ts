import "server-only";

import { getDb } from "@/infrastructure/cloudflare";
import type { PlanId, PlanLimits } from "@/types";

/**
 * Adapter D1 de los planes.
 *
 * Los límites y precios se leen de la base y no del código: RF-096 pide
 * poder cambiarlos sin desplegar. Como cambian muy poco y se consultan en
 * casi todas las páginas del panel, se cachean por request.
 */

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  period: string;
  rank: number;
  max_services: number;
  max_subcategories: number;
  max_service_areas: number;
  max_gallery_images: number;
  max_team_members: number;
  allows_social_links: number;
  allows_landing: number;
  allows_featured: number;
  allows_contact_form: number;
  allows_verification_request: number;
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
    maxServices: row.max_services,
    maxSubcategories: row.max_subcategories,
    maxServiceAreas: row.max_service_areas,
    maxGalleryImages: row.max_gallery_images,
    maxTeamMembers: row.max_team_members,
    allowsSocialLinks: row.allows_social_links === 1,
    allowsLanding: row.allows_landing === 1,
    allowsFeatured: row.allows_featured === 1,
    allowsContactForm: row.allows_contact_form === 1,
    allowsVerificationRequest: row.allows_verification_request === 1,
    metricsLevel: row.metrics_level as PlanLimits["metricsLevel"],
  };
}

const COLUMNS = `id, name, price_cents, currency, period, rank,
  max_services, max_subcategories, max_service_areas, max_gallery_images,
  max_team_members, allows_social_links, allows_landing, allows_featured,
  allows_contact_form, allows_verification_request, metrics_level`;

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
