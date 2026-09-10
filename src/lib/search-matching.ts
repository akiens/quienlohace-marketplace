import { SERVICE_INDEX, normalize } from "@/data/services";
import { getSpecialty } from "@/data/taxonomy";
import type {
  Profile,
  SearchMatchReason,
  SearchQueryPlan,
  ServiceCard,
} from "@/types";

export type SearchEvidenceLevel = "explicit" | "specialty" | "discovery";

export type SearchMatch = {
  reason: SearchMatchReason;
  label: string;
  relevance: number;
  level: SearchEvidenceLevel;
};

function containsPhrase(haystack: string, needle: string): boolean {
  return haystack === needle || ` ${haystack} `.includes(` ${needle} `);
}

function phraseStrength(value: string, phrases: string[]): number {
  const haystack = normalize(value);
  let best = 0;
  for (const phrase of phrases) {
    const needle = normalize(phrase);
    if (!needle) continue;
    if (haystack === needle) best = Math.max(best, 130);
    else if (containsPhrase(haystack, needle)) best = Math.max(best, 120);
  }
  return best;
}

function includesEveryTerm(value: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = normalize(value);
  return terms.every((term) => containsPhrase(haystack, normalize(term)));
}

function respectsExclusions(value: string, plan: SearchQueryPlan): boolean {
  const haystack = normalize(value);
  return !plan.exclusions.some((term) => containsPhrase(haystack, normalize(term)));
}

function canonicalServiceStrength(
  value: string,
  specialtyId: string,
  serviceIds: string[],
): number {
  const candidates = SERVICE_INDEX.filter((service) =>
    service.specialtyId === specialtyId && serviceIds.includes(service.id));
  let best = 0;
  for (const service of candidates) {
    best = Math.max(best, phraseStrength(value, [service.name, ...service.aliases]));
  }
  return best;
}

function providerNameMatch(name: string, plan: SearchQueryPlan): SearchMatch | null {
  if (plan.intent !== "text") return null;
  const strength = phraseStrength(name, [plan.normalized]);
  return strength > 0
    ? { reason: "provider_name", label: `Nombre: ${name}`, relevance: strength, level: "explicit" }
    : null;
}

export function matchProfile(profile: Profile, plan: SearchQueryPlan): SearchMatch | null {
  if (plan.intent === "empty") {
    return { reason: "discovery", label: "Perfil disponible", relevance: 10, level: "discovery" };
  }

  const byName = providerNameMatch(profile.name, plan);
  if (byName) return byName;

  const activeServices = profile.services.filter((service) => service.isActive);
  if (plan.intent === "service") {
    for (const service of activeServices) {
      const strength = canonicalServiceStrength(service.name, service.specialtyId, plan.serviceIds);
      if (strength > 0 && respectsExclusions(service.name, plan)) {
        return {
          reason: "declared_service",
          label: service.name,
          relevance: strength,
          level: "explicit",
        };
      }
    }
    return null;
  }

  if (plan.intent === "specialty") {
    const declaredServices = activeServices.filter((service) =>
      plan.specialtyIds.includes(service.specialtyId));
    const declared = declaredServices.sort((left, right) =>
      phraseStrength(right.name, plan.exactTerms) - phraseStrength(left.name, plan.exactTerms)
      || left.sortOrder - right.sortOrder)[0];
    if (declared) {
      const direct = phraseStrength(declared.name, plan.exactTerms);
      return {
        reason: "declared_service",
        label: declared.name,
        relevance: direct || 105,
        level: "explicit",
      };
    }
    const specialtyId = profile.specialtyIds.find((id) => plan.specialtyIds.includes(id));
    if (!specialtyId) return null;
    return {
      reason: "specialty",
      label: getSpecialty(specialtyId)?.name ?? plan.label ?? "Especialidad relacionada",
      relevance: 70,
      level: "specialty",
    };
  }

  for (const service of activeServices) {
    if (includesEveryTerm(service.name, plan.coreTerms) && respectsExclusions(service.name, plan)) {
      return {
        reason: "declared_service",
        label: service.name,
        relevance: phraseStrength(service.name, plan.exactTerms) || 90,
        level: "explicit",
      };
    }
  }
  return null;
}

export function matchServiceCard(card: ServiceCard, plan: SearchQueryPlan): SearchMatch | null {
  if (plan.intent === "empty") {
    return { reason: "discovery", label: card.serviceName, relevance: 11, level: "discovery" };
  }

  const byName = providerNameMatch(card.providerName, plan);
  if (byName) return byName;

  const offerText = `${card.title} ${card.serviceName} ${card.description}`;
  if (!respectsExclusions(offerText, plan)) return null;

  if (plan.intent === "service") {
    const titleStrength = canonicalServiceStrength(card.title, card.specialtyId, plan.serviceIds);
    const serviceStrength = canonicalServiceStrength(card.serviceName, card.specialtyId, plan.serviceIds);
    const strength = Math.max(titleStrength, serviceStrength);
    if (strength === 0) return null;
    return {
      reason: titleStrength >= serviceStrength ? "card_title" : "declared_service",
      label: titleStrength >= serviceStrength ? card.title : card.serviceName,
      relevance: strength + (titleStrength > 0 ? 2 : 0),
      level: "explicit",
    };
  }

  if (plan.intent === "specialty") {
    if (!plan.specialtyIds.includes(card.specialtyId)) return null;
    const directTitle = phraseStrength(card.title, plan.exactTerms);
    const directService = phraseStrength(card.serviceName, plan.exactTerms);
    return {
      reason: directTitle > 0 ? "card_title" : "declared_service",
      label: directTitle > 0 ? card.title : card.serviceName,
      relevance: Math.max(directTitle + 2, directService, 110),
      level: "explicit",
    };
  }

  if (!includesEveryTerm(offerText, plan.coreTerms)) return null;
  const directTitle = phraseStrength(card.title, plan.exactTerms);
  return {
    reason: directTitle > 0 ? "card_title" : "description",
    label: directTitle > 0 ? card.title : card.serviceName,
    relevance: directTitle || 85,
    level: "explicit",
  };
}
