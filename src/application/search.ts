import "server-only";

import { SERVICE_SECTORS, getSpecialty } from "@/data/taxonomy";
import { effectivePlanId } from "@/domain/plan-changes";
import { D1ProfileRepository } from "@/infrastructure/d1-profile-repository";
import { D1ServiceCardRepository } from "@/infrastructure/d1-service-card-repository";
import { analyticsEnabled, runInBackground } from "@/infrastructure/cloudflare";
import { recordServerSearch } from "@/infrastructure/d1-analytics-repository";
import { filtersToQuery } from "@/lib/query";
import { interpretSearchQuery } from "@/lib/search-intent";
import {
  matchProfile,
  matchServiceCard,
  type SearchMatch,
} from "@/lib/search-matching";
import { rankMixedSearchResults } from "@/lib/search-ranking";
import { PAGE_SIZE } from "@/types";
import type {
  Profile,
  ProfileSearchCandidate,
  SearchFilters,
  SearchQueryPlan,
  SearchSuggestion,
  ServiceCard,
  ServiceCardSearchCandidate,
} from "@/types";

const profileRepo = new D1ProfileRepository();
const cardRepo = new D1ServiceCardRepository();
export type MarketplaceSearchItem =
  | { kind: "profile"; providerId: string; planId: Profile["planId"]; profile: Profile; match: SearchMatch }
  | { kind: "service"; providerId: string; planId: Profile["planId"]; card: ServiceCard; match: SearchMatch };

type SearchCandidateItem =
  | { kind: "profile"; providerId: string; planId: Profile["planId"]; candidate: ProfileSearchCandidate; match: SearchMatch }
  | { kind: "service"; providerId: string; planId: Profile["planId"]; candidate: ServiceCardSearchCandidate; match: SearchMatch };

export type MarketplaceSearchResult = {
  prepared: boolean;
  interpretation: SearchQueryPlan;
  results: MarketplaceSearchItem[];
  total: number;
  providerTotal: number;
  discoveryLinks: SearchSuggestion[];
  suggestedActions: SearchSuggestion[];
  analytics: {
    searchId: string;
    searchExecutionId: string;
    resultSetId: string;
    resultItemIds: string[];
    snapshotIds: string[];
    executionIds: string[];
    performance?: {
      totalDurationMs: number;
      candidateQueryMs: number;
      matchingRankingMs: number;
      hydrationMs: number;
      snapshotMs: number;
      candidateCount: number;
      eligibleCount: number;
    };
  };
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    remaining: number;
    returned: number;
    nextCursor: string | null;
    reset: boolean;
  };
};

function snapshotId(entityKey: string, value: Record<string, unknown>): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(`${entityKey}:${JSON.stringify(value)}`)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `snapshot_${hash.toString(16).padStart(16, "0")}`;
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

function quality(rating: number | null, reviews: number): number {
  if (rating === null) return 0;
  return (reviews * rating + 5 * 3.5) / (reviews + 5);
}

function candidateQuality(item: SearchCandidateItem): number {
  return item.kind === "profile"
    ? quality(item.candidate.rating, item.candidate.reviewCount)
    : quality(item.candidate.providerRating, item.candidate.providerReviewCount);
}

async function candidates(filters: SearchFilters, plan: SearchQueryPlan) {
  return Promise.all([
    includeProfiles(filters)
      ? profileRepo.searchCandidates(filters, plan)
      : Promise.resolve([]),
    includeCards(filters)
      ? cardRepo.searchCandidates(filters, plan)
      : Promise.resolve([]),
  ]);
}

export async function searchMarketplace(
  filters: SearchFilters,
  requestedPage = 1,
  continuity?: { searchId: string; resultSetId: string },
  requestedCursor: string | null = null,
): Promise<MarketplaceSearchResult> {
  const started = performance.now();
  let searchId = continuity?.searchId ?? `search_${crypto.randomUUID()}`;
  const searchExecutionId = `execution_${crypto.randomUUID()}`;
  let resultSetId = continuity?.resultSetId ?? `results_${crypto.randomUUID()}`;
  const interpretation = interpretSearchQuery(filters.query);
  const candidateStarted = performance.now();
  const [profiles, cards] = await candidates(filters, interpretation);
  const candidateQueryMs = Math.max(0, Math.round(performance.now() - candidateStarted));
  const matchingStarted = performance.now();
  const eligible: SearchCandidateItem[] = [];

  for (const profile of profiles) {
    const match = matchProfile(profile, interpretation);
    if (match) eligible.push({
      kind: "profile", providerId: profile.id,
      planId: effectivePlanId(profile), candidate: profile, match,
    });
  }
  for (const card of cards) {
    const match = matchServiceCard(card, interpretation);
    if (match) eligible.push({
      kind: "service", providerId: card.profileId,
      planId: effectivePlanId({
        planId: card.providerPlanId,
        subscriptionStatus: card.providerSubscriptionStatus,
        planExpiresAt: card.providerPlanExpiresAt,
        downgradePlanId: card.providerDowngradePlanId,
      }),
      candidate: card, match,
    });
  }

  const rankedCandidates = rankMixedSearchResults(
    eligible,
    candidateQuality,
    (item) => item.candidate.id,
  );
  const matchingRankingMs = Math.max(0, Math.round(performance.now() - matchingStarted));
  const total = rankedCandidates.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedOffset = (Math.min(Math.max(1, requestedPage), totalPages) - 1) * PAGE_SIZE;
  const rankingVersion = snapshotId("search-ranking-v2", {
    filters: filtersToQuery(filters),
    ids: rankedCandidates.map((item) => `${item.kind}:${item.candidate.id}:${item.planId}`),
  }).slice("snapshot_".length);
  const cursorForOffset = (cursorOffset: number) => `v2_${cursorOffset}_${rankingVersion}`;
  const reset = Boolean(
    requestedCursor
    && requestedCursor !== cursorForOffset(requestedOffset),
  );
  const page = reset ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
  if (reset) {
    searchId = `search_${crypto.randomUUID()}`;
    resultSetId = `results_${crypto.randomUUID()}`;
  }
  const offset = (page - 1) * PAGE_SIZE;
  const pageCandidates = rankedCandidates.slice(offset, offset + PAGE_SIZE);
  const hydrationStarted = performance.now();
  const profileIds = pageCandidates.filter((item) => item.kind === "profile").map((item) => item.candidate.id);
  const cardIds = pageCandidates.filter((item) => item.kind === "service").map((item) => item.candidate.id);
  const [hydratedProfiles, hydratedCards] = await Promise.all([
    profileRepo.findPublicByIds(profileIds),
    cardRepo.findPublicByIds(cardIds),
  ]);
  const profilesById = new Map(hydratedProfiles.map((profile) => [profile.id, profile]));
  const cardsById = new Map(hydratedCards.map((card) => [card.id, card]));
  const results = pageCandidates.flatMap((item): MarketplaceSearchItem[] => {
    if (item.kind === "profile") {
      const profile = profilesById.get(item.candidate.id);
      return profile ? [{ kind: "profile", providerId: item.providerId, planId: item.planId, profile, match: item.match }] : [];
    }
    const card = cardsById.get(item.candidate.id);
    return card ? [{ kind: "service", providerId: item.providerId, planId: item.planId, card, match: item.match }] : [];
  });
  const hydrationMs = Math.max(0, Math.round(performance.now() - hydrationStarted));
  const providerTotal = new Set(rankedCandidates.map((item) => item.providerId)).size;
  const suggestedActions: SearchSuggestion[] = [];
  if (total === 0 && interpretation.suggestedQuery) {
    suggestedActions.push({
      label: `Buscar “${interpretation.suggestedQuery}”`,
      detail: "Posible corrección de escritura",
      href: href({ ...filters, query: interpretation.suggestedQuery }),
    });
  }

  const snapshotStarted = performance.now();
  const snapshots = results.map((item) => {
    const snapshot = item.kind === "profile" ? {
      type: item.profile.type, planId: item.profile.planId, status: item.profile.profileStatus,
      verificationStatus: item.profile.verificationStatus, rating: item.profile.rating,
      reviewCount: item.profile.reviewCount, specialtyIds: item.profile.specialtyIds,
      serviceModes: item.profile.serviceModes, serviceAreaIds: item.profile.serviceAreaIds,
      activeServiceIds: item.profile.services.filter((service) => service.isActive).map((service) => service.id),
      paymentMethods: item.profile.paymentMethods,
      enabledChannels: [item.profile.whatsappEnabled ? "whatsapp" : null, item.profile.phonePublic ? "phone" : null, item.profile.contactEmail ? "email" : null].filter(Boolean),
    } : {
      priceKind: item.card.priceKind, priceMinCents: item.card.priceMinCents,
      priceMaxCents: item.card.priceMaxCents, currency: item.card.currency, tier: item.card.tier,
      serviceMode: item.card.serviceMode, paymentMethod: item.card.paymentMethod,
      durationMinMinutes: item.card.durationMinMinutes, durationMaxMinutes: item.card.durationMaxMinutes,
      imageVersion: item.card.images.map((image) => image.id),
      isPublished: item.card.isPublished, isActive: item.card.isActive,
    };
    const entityKey = item.kind === "profile" ? `profile:${item.profile.id}` : `card:${item.card.id}`;
    return { snapshot, snapshotId: snapshotId(entityKey, snapshot) };
  });
  const resultItemIds = results.map((_, index) => `${resultSetId}:item:${offset + index + 1}`);
  const snapshotMs = Math.max(0, Math.round(performance.now() - snapshotStarted));
  const searchDurationMs = Math.max(0, Math.round(performance.now() - started));
  const searchPerformance = {
    totalDurationMs: searchDurationMs,
    candidateQueryMs,
    matchingRankingMs,
    hydrationMs,
    snapshotMs,
    candidateCount: profiles.length + cards.length,
    eligibleCount: total,
  };
  console.info("marketplace_search_performance", JSON.stringify({
    searchExecutionId, page, ...searchPerformance,
  }));

  if (analyticsEnabled()) {
    try {
      runInBackground(recordServerSearch({
        searchId, executionId: searchExecutionId, resultSetId, executedAt: new Date().toISOString(),
        durationMs: searchDurationMs, total,
        providerTotal,
        interpretation: {
          specialtyIds: interpretation.specialtyIds,
          serviceIds: interpretation.serviceIds,
          inferredMode: interpretation.inferredMode,
          correctionStatus: interpretation.suggestedQuery ? "suggested" : "none",
          normalizerVersion: 1,
          filters: {
            resultKinds: filters.resultKinds, locationIds: filters.locationIds,
            specialtyIds: filters.specialtyIds, minRating: filters.minRating,
            paymentMethods: filters.paymentMethods, serviceModes: filters.serviceModes,
            useMyLocation: filters.useMyLocation, queryPresent: Boolean(filters.query.trim()),
          },
        },
        items: results.map((item, index) => ({
          resultItemId: resultItemIds[index]!, position: offset + index + 1, resultKind: item.kind,
          providerProfileId: item.providerId,
          profileServiceId: item.kind === "service" ? item.card.serviceId : null,
          serviceCardId: item.kind === "service" ? item.card.id : null,
          specialtyId: item.kind === "service" ? item.card.specialtyId : item.profile.specialtyIds[0] ?? null,
          snapshotId: snapshots[index]!.snapshotId, snapshot: snapshots[index]!.snapshot,
          matchReason: item.match.reason,
        })),
      }));
    } catch (error) {
      console.error("analytics search capture failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
    }
  }

  return {
    prepared: false,
    interpretation,
    results,
    total,
    providerTotal,
    discoveryLinks: discoveryLinks(filters, interpretation),
    suggestedActions,
    analytics: {
      searchId, searchExecutionId, resultSetId, resultItemIds,
      snapshotIds: snapshots.map((item) => item.snapshotId),
      executionIds: results.map(() => searchExecutionId),
      performance: searchPerformance,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      hasMore: offset + pageCandidates.length < total,
      remaining: Math.max(0, total - offset - pageCandidates.length),
      returned: results.length,
      nextCursor: offset + pageCandidates.length < total
        ? cursorForOffset(offset + PAGE_SIZE)
        : null,
      reset,
    },
  };
}
