import snapshot from "@/data/marketplace-showcase.generated.json";
import { MARKETPLACE_SHOWCASE } from "@/data/marketplace-showcase";
import { SERVICE_SECTORS } from "@/data/taxonomy";
import { effectivePlanId } from "@/domain/plan-changes";
import { matchProfile, matchServiceCard } from "@/lib/search-matching";
import { rankMixedSearchResults } from "@/lib/search-ranking";
import { interpretSearchQuery } from "@/lib/search-intent";
import { EMPTY_FILTERS, PAGE_SIZE } from "@/types";
import type { MarketplaceSearchItem, MarketplaceSearchResult } from "@/application/search";
import type { Profile, ServiceCard } from "@/types";

type GeneratedSnapshot = {
  selection: typeof MARKETPLACE_SHOWCASE;
  home: { featured: Profile[]; topRated: Profile[] };
  search: Array<
    | { kind: "profile"; profile: Profile }
    | { kind: "service"; card: ServiceCard }
  >;
};

const generated = snapshot as GeneratedSnapshot;

if (JSON.stringify(generated.selection) !== JSON.stringify(MARKETPLACE_SHOWCASE)) {
  throw new Error(
    "La selección del showcase cambió. Ejecutá `npm run showcase:generate:remote` antes del build.",
  );
}

export function getPreparedHomeSections(): GeneratedSnapshot["home"] {
  return generated.home;
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

/** Resultado completo creado sólo con el JSON incluido en el build. */
export function getPreparedSearchResult(): MarketplaceSearchResult {
  const interpretation = interpretSearchQuery("");
  const providerPlans = new Map<string, Profile["planId"]>();
  for (const profile of [
    ...generated.home.featured,
    ...generated.home.topRated,
    ...generated.search.flatMap((item) => item.kind === "profile" ? [item.profile] : []),
  ]) {
    providerPlans.set(profile.id, effectivePlanId(profile));
  }
  const candidates = generated.search.map((item): MarketplaceSearchItem =>
    item.kind === "profile"
      ? {
          kind: "profile",
          providerId: item.profile.id,
          planId: effectivePlanId(item.profile),
          profile: item.profile,
          match: matchProfile(item.profile, interpretation)!,
        }
      : {
          kind: "service",
          providerId: item.card.profileId,
          planId: providerPlans.get(item.card.profileId) ?? "cobre",
          card: item.card,
          match: matchServiceCard(item.card, interpretation)!,
        },
  );
  const results = rankMixedSearchResults(
    candidates,
    itemQuality,
    (item) => item.kind === "profile" ? item.profile.id : item.card.id,
  ).slice(0, PAGE_SIZE);
  const providerTotal = new Set(results.map((item) => item.providerId)).size;

  return {
    prepared: true,
    interpretation,
    results,
    total: results.length,
    providerTotal,
    discoveryLinks: SERVICE_SECTORS.slice(0, 6).map((sector) => ({
      label: sector.short,
      detail: "Explorar este rubro",
      href: `/categorias/${sector.slug}`,
    })),
    suggestedActions: [],
    analytics: {
      searchId: "",
      searchExecutionId: "",
      resultSetId: "",
      resultItemIds: results.map((_, index) => `prepared_search:item:${index + 1}`),
      snapshotIds: [],
      executionIds: [],
    },
    pagination: {
      page: 1, pageSize: PAGE_SIZE, hasMore: false, remaining: 0,
      returned: results.length, nextCursor: null, reset: false,
    },
  };
}

export { EMPTY_FILTERS };
