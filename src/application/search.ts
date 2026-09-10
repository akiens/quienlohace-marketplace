import "server-only";

import { SERVICE_SECTORS, getSpecialty } from "@/data/taxonomy";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import { filtersToQuery } from "@/lib/query";
import { interpretSearchQuery } from "@/lib/search-intent";
import { normalize } from "@/data/services";
import { softlyDiversify } from "@/lib/search-ranking";
import type {
  Profile,
  SearchFilters,
  SearchMatchReason,
  SearchQueryPlan,
  SearchSuggestion,
  ServiceCard,
} from "@/types";

const profileRepo = new D1ProfileRepository();
const cardRepo = new D1ServiceCardRepository();
const RESULT_LIMIT = 48;
const CANDIDATE_LIMIT = 48;
const DISCOVERY_LIMIT = 6;

export type SearchMatch = { reason: SearchMatchReason; label: string; relevance: number };

export type MarketplaceSearchResult = {
  interpretation: SearchQueryPlan;
  profiles: Profile[];
  profileTotal: number;
  profileMatches: Record<string, SearchMatch>;
  serviceCards: ServiceCard[];
  serviceTotal: number;
  serviceProviderTotal: number;
  cardMatches: Record<string, SearchMatch>;
  discoveryProfiles: Profile[];
  discoveryCards: ServiceCard[];
  discoveryRelated: boolean;
  discoveryLinks: SearchSuggestion[];
  suggestedActions: SearchSuggestion[];
};

function includesAny(value: string, phrases: string[]): boolean {
  const haystack = normalize(value);
  return phrases.some((phrase) => phrase.length >= 3 && haystack.includes(phrase));
}

function includesTerms(value: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const haystack = normalize(value);
  return terms.every((term) => haystack.includes(term));
}

function profileMatch(profile: Profile, plan: SearchQueryPlan): SearchMatch {
  if (includesAny(profile.name, [plan.normalized])) {
    return { reason: "provider_name", label: `Nombre: ${profile.name}`, relevance: 100 };
  }
  const service = profile.services.find((item) => item.isActive &&
    (includesAny(item.name, plan.phrases) || includesTerms(item.name, plan.coreTerms)));
  if (service) {
    const exact = includesAny(service.name, plan.phrases.filter((phrase) => phrase.includes(" ")));
    return { reason: "declared_service", label: service.name, relevance: exact ? 100 : 70 };
  }
  if (includesAny(profile.description, plan.phrases) || includesTerms(profile.description, plan.coreTerms)) {
    return { reason: "description", label: plan.label ?? "Descripción del perfil", relevance: 50 };
  }
  const specialty = profile.specialtyIds.map(getSpecialty).find((item) =>
    item && plan.specialtyIds.includes(item.id));
  return { reason: "specialty", label: specialty?.name ?? plan.label ?? "Especialidad relacionada", relevance: 30 };
}

function cardMatch(card: ServiceCard, plan: SearchQueryPlan): SearchMatch {
  if (includesAny(card.title, plan.phrases) || includesTerms(card.title, plan.coreTerms)) {
    const exact = includesAny(card.title, plan.phrases.filter((phrase) => phrase.includes(" ")));
    return { reason: "card_title", label: card.title, relevance: exact ? 100 : 70 };
  }
  if (includesAny(card.providerName, [plan.normalized])) {
    return { reason: "provider_name", label: `Proveedor: ${card.providerName}`, relevance: 100 };
  }
  if (includesAny(card.description, plan.phrases) || includesTerms(card.description, plan.coreTerms)) {
    return { reason: "description", label: plan.label ?? "Descripción de la propuesta", relevance: 50 };
  }
  return { reason: "specialty", label: getSpecialty(card.specialtyId)?.name ?? plan.label ?? "Especialidad relacionada", relevance: 30 };
}

function reasonWeight(reason: SearchMatchReason): number {
  return { provider_name: 6, declared_service: 5, card_title: 5, description: 3, specialty: 2, discovery: 1 }[reason];
}

function quality(rating: number | null, reviews: number): number {
  if (rating === null) return 0;
  return (reviews * rating + 5 * 3.5) / (reviews + 5);
}

function rankProfiles(profiles: Profile[], plan: SearchQueryPlan) {
  const matches: Record<string, SearchMatch> = {};
  for (const profile of profiles) matches[profile.id] = profileMatch(profile, plan);
  profiles.sort((a, b) => reasonWeight(matches[b.id]!.reason) - reasonWeight(matches[a.id]!.reason)
    || matches[b.id]!.relevance - matches[a.id]!.relevance
    || quality(b.rating, b.reviewCount) - quality(a.rating, a.reviewCount)
    || a.id.localeCompare(b.id));
  return matches;
}

function rankAndDiversifyCards(cards: ServiceCard[], plan: SearchQueryPlan) {
  const matches: Record<string, SearchMatch> = {};
  for (const card of cards) matches[card.id] = cardMatch(card, plan);
  const cardScore = (card: ServiceCard) =>
    reasonWeight(matches[card.id]!.reason) * 100
    + matches[card.id]!.relevance
    + quality(card.providerRating, card.providerReviewCount);
  cards.sort((a, b) => cardScore(b) - cardScore(a) || a.id.localeCompare(b.id));
  return {
    cards: softlyDiversify(cards, (card) => card.profileId, cardScore),
    matches,
  };
}

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

async function countBoth(filters: SearchFilters, plan: SearchQueryPlan): Promise<number> {
  const [profiles, cards] = await Promise.all([
    includeProfiles(filters) ? profileRepo.countForSearch(filters, plan) : Promise.resolve(0),
    includeCards(filters) ? cardRepo.count(filters, plan) : Promise.resolve(0),
  ]);
  return profiles + cards;
}

async function relaxationActions(filters: SearchFilters, plan: SearchQueryPlan): Promise<SearchSuggestion[]> {
  const candidates: Array<{ label: string; detail: string; filters: SearchFilters }> = [];
  if (filters.locationIds.length) candidates.push({
    label: "Ver sin filtro de zona", detail: "Hay coincidencias al ampliar la cobertura",
    filters: { ...filters, locationIds: [], useMyLocation: false },
  });
  if (filters.minRating !== null) candidates.push({
    label: "Ver sin mínimo de estrellas", detail: "Hay coincidencias con otras calificaciones",
    filters: { ...filters, minRating: null },
  });
  if (filters.serviceModes.length) candidates.push({
    label: "Ver todas las modalidades", detail: "Hay coincidencias con otras modalidades",
    filters: { ...filters, serviceModes: [] },
  });
  const checked = await Promise.all(candidates.map(async (candidate) => ({
    ...candidate, available: await countBoth(candidate.filters, plan),
  })));
  return checked.filter((item) => item.available > 0).map((item) => ({
    label: item.label, detail: item.detail, href: href(item.filters),
  }));
}

export async function searchMarketplace(filters: SearchFilters): Promise<MarketplaceSearchResult> {
  const interpretation = interpretSearchQuery(filters.query);
  const profilesEnabled = includeProfiles(filters);
  const cardsEnabled = includeCards(filters);
  const [profileCandidates, profileTotal, cardCandidates, serviceTotal, serviceProviderTotal] = await Promise.all([
    profilesEnabled ? profileRepo.search(filters, CANDIDATE_LIMIT, 0, interpretation) : Promise.resolve([]),
    profilesEnabled ? profileRepo.countForSearch(filters, interpretation) : Promise.resolve(0),
    cardsEnabled ? cardRepo.search(filters, CANDIDATE_LIMIT, interpretation) : Promise.resolve([]),
    cardsEnabled ? cardRepo.count(filters, interpretation) : Promise.resolve(0),
    cardsEnabled ? cardRepo.countProviders(filters, interpretation) : Promise.resolve(0),
  ]);

  const profileMatches = rankProfiles(profileCandidates, interpretation);
  const rankedCards = rankAndDiversifyCards(cardCandidates, interpretation);
  const profiles = profileCandidates.slice(0, RESULT_LIMIT);
  const serviceCards = rankedCards.cards.slice(0, RESULT_LIMIT);
  const total = profileTotal + serviceTotal;
  let discoveryProfiles: Profile[] = [];
  let discoveryCards: ServiceCard[] = [];
  let discoveryRelated = false;
  let suggestedActions: SearchSuggestion[] = [];

  if (filters.query.trim() && total === 0) {
    const relatedSpecialties = filters.specialtyIds.length === 0 ? interpretation.specialtyIds : [];
    const relatedFilters: SearchFilters = {
      ...filters,
      query: "",
      specialtyIds: relatedSpecialties.length ? relatedSpecialties : filters.specialtyIds,
    };
    const [relatedProfiles, relatedCards] = await Promise.all([
      profilesEnabled ? profileRepo.search(relatedFilters, 24, 0) : Promise.resolve([]),
      cardsEnabled ? cardRepo.search(relatedFilters, 48) : Promise.resolve([]),
    ]);
    discoveryRelated = relatedSpecialties.length > 0 && (relatedProfiles.length > 0 || relatedCards.length > 0);

    if (discoveryRelated) {
      discoveryProfiles = relatedProfiles.slice(0, DISCOVERY_LIMIT);
      discoveryCards = rankAndDiversifyCards(relatedCards, interpretation).cards.slice(0, DISCOVERY_LIMIT);
    } else {
      const generalFilters = { ...filters, query: "" };
      const [generalProfiles, generalCards] = await Promise.all([
        profilesEnabled ? profileRepo.search(generalFilters, DISCOVERY_LIMIT, 0) : Promise.resolve([]),
        cardsEnabled ? cardRepo.search(generalFilters, 24) : Promise.resolve([]),
      ]);
      discoveryProfiles = generalProfiles.slice(0, DISCOVERY_LIMIT);
      discoveryCards = rankAndDiversifyCards(generalCards, interpretation).cards.slice(0, DISCOVERY_LIMIT);
    }
    suggestedActions = await relaxationActions(filters, interpretation);
  }

  if (total === 0 && interpretation.suggestedQuery) {
    suggestedActions.unshift({
      label: `Buscar “${interpretation.suggestedQuery}”`,
      detail: "Posible corrección de escritura",
      href: href({ ...filters, query: interpretation.suggestedQuery }),
    });
  }

  return {
    interpretation, profiles, profileTotal, profileMatches,
    serviceCards, serviceTotal, serviceProviderTotal,
    cardMatches: rankedCards.matches,
    discoveryProfiles, discoveryCards, discoveryRelated,
    discoveryLinks: discoveryLinks(filters, interpretation), suggestedActions,
  };
}
