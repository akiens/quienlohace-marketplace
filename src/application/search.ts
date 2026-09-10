import "server-only";

import { SERVICE_SECTORS, getSpecialty } from "@/data/taxonomy";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import { filtersToQuery } from "@/lib/query";
import { interpretSearchQuery } from "@/lib/search-intent";
import {
  matchProfile,
  matchServiceCard,
  type SearchMatch,
} from "@/lib/search-matching";
import { rankMixedSearchResults } from "@/lib/search-ranking";
import type {
  Profile,
  SearchFilters,
  SearchQueryPlan,
  SearchSuggestion,
  ServiceCard,
} from "@/types";

const profileRepo = new D1ProfileRepository();
const cardRepo = new D1ServiceCardRepository();
const EXPLORATION_CANDIDATES_PER_TYPE = 48;

export type MarketplaceSearchItem =
  | { kind: "profile"; providerId: string; profile: Profile; match: SearchMatch }
  | { kind: "service"; providerId: string; card: ServiceCard; match: SearchMatch };

export type MarketplaceSearchResult = {
  interpretation: SearchQueryPlan;
  results: MarketplaceSearchItem[];
  total: number;
  providerTotal: number;
  discoveryLinks: SearchSuggestion[];
  suggestedActions: SearchSuggestion[];
};

function includeProfiles(filters: SearchFilters): boolean {
  return filters.resultKinds.length === 0 || filters.resultKinds.some((kind) => kind !== "service");
}

function includeCards(filters: SearchFilters): boolean {
  return filters.resultKinds.length === 0 || filters.resultKinds.includes("service");
}

function href(filters: SearchFilters): string {
  const query = filtersToQuery(filters);
  return query ? `/buscar?${query}` : "/buscar";
}

function discoveryLinks(filters: SearchFilters, plan: SearchQueryPlan): SearchSuggestion[] {
  const specialties = plan.specialtyIds.map(getSpecialty).filter((item) => item !== undefined).slice(0, 6);
  if (specialties.length) {
    return specialties.map((specialty) => ({
      label: specialty.name,
      detail: `Explorar profesionales y propuestas de ${specialty.name.toLocaleLowerCase("es")}`,
      href: href({ ...filters, query: "", specialtyIds: [...new Set([...filters.specialtyIds, specialty.id])] }),
    }));
  }
  return SERVICE_SECTORS.slice(0, 6).map((sector) => ({
    label: sector.short,
    detail: "Explorar este rubro",
    href: `/categorias/${sector.slug}`,
  }));
}

function quality(rating: number | null, reviews: number): number {
  if (rating === null) return 0;
  return (reviews * rating + 5 * 3.5) / (reviews + 5);
}

function itemQuality(item: MarketplaceSearchItem): number {
  return item.kind === "profile"
    ? quality(item.profile.rating, item.profile.reviewCount)
    : quality(item.card.providerRating, item.card.providerReviewCount);
}

async function candidates(filters: SearchFilters, plan: SearchQueryPlan) {
  const hasQuery = Boolean(filters.query.trim());
  return Promise.all([
    includeProfiles(filters)
      ? hasQuery
        ? profileRepo.searchAll(filters, plan)
        : profileRepo.search(filters, EXPLORATION_CANDIDATES_PER_TYPE, 0, plan)
      : Promise.resolve([]),
    includeCards(filters)
      ? hasQuery
        ? cardRepo.searchAll(filters, plan)
        : cardRepo.search(filters, EXPLORATION_CANDIDATES_PER_TYPE, plan)
      : Promise.resolve([]),
  ]);
}

export async function searchMarketplace(filters: SearchFilters): Promise<MarketplaceSearchResult> {
  const interpretation = interpretSearchQuery(filters.query);
  const [profiles, cards] = await candidates(filters, interpretation);
  const eligible: MarketplaceSearchItem[] = [];

  for (const profile of profiles) {
    const match = matchProfile(profile, interpretation);
    if (match) eligible.push({ kind: "profile", providerId: profile.id, profile, match });
  }
  for (const card of cards) {
    const match = matchServiceCard(card, interpretation);
    if (match) eligible.push({ kind: "service", providerId: card.profileId, card, match });
  }

  const results = rankMixedSearchResults(eligible, itemQuality);
  const suggestedActions: SearchSuggestion[] = [];
  if (results.length === 0 && interpretation.suggestedQuery) {
    suggestedActions.push({
      label: `Buscar “${interpretation.suggestedQuery}”`,
      detail: "Posible corrección de escritura",
      href: href({ ...filters, query: interpretation.suggestedQuery }),
    });
  }

  return {
    interpretation,
    results,
    total: results.length,
    providerTotal: new Set(results.map((item) => item.providerId)).size,
    discoveryLinks: discoveryLinks(filters, interpretation),
    suggestedActions,
  };
}
