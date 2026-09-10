import { OCCUPATION_SPECIALTIES, SEARCH_NEEDS } from "@/data/search-discovery";
import { SERVICE_INDEX, normalize } from "@/data/services";
import { SERVICE_SECTORS, SPECIALTIES, getSpecialty } from "@/data/taxonomy";
import type { IndexedService } from "@/data/services";
import type { SearchQueryPlan, ServiceModeCode } from "@/types";

const FILLER = new Set([
  "a", "al", "algo", "alguien", "busco", "con", "de", "del", "el", "en",
  "esta", "este", "hacer", "la", "las", "lo", "los", "me", "mi", "necesito",
  "para", "por", "porque", "que", "quiero", "se", "un", "una", "venga", "yo",
]);
const NEGATIONS = new Set(["no", "sin"]);
const ACTIVITY_ROOTS = ["arregl", "diagnostic", "instal", "limpi", "manten", "repar", "revis"];

function words(value: string): string[] {
  return normalize(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function rootsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return left.startsWith(right.slice(0, 5)) || right.startsWith(left.slice(0, 5));
}

function meaningful(value: string): string[] {
  return words(value).filter((word) => word.length > 2 && !FILLER.has(word) && !NEGATIONS.has(word));
}

function scoreService(service: IndexedService, query: string, needles: string[]): number {
  const forms = [service.search.name, ...service.search.aliases];
  if (forms.some((form) => form === query)) return 120;
  const asPhrase = (haystack: string, needle: string) =>
    ` ${haystack} `.includes(` ${needle} `);
  const contained = forms.find((form) => form.length >= 4 && asPhrase(query, form));
  if (contained) {
    const covered = meaningful(contained).length / Math.max(needles.length, 1);
    if (covered >= 0.75) return 110;
  }
  if (forms.some((form) => query.length >= 4 && asPhrase(form, query))) return 100;

  const serviceWords = meaningful([service.name, ...service.aliases].join(" "));
  const matched = needles.filter((needle) =>
    serviceWords.some((candidate) => rootsMatch(needle, candidate)),
  );
  if (matched.length === 0) return 0;

  const coverage = matched.length / Math.max(needles.length, 1);
  let points = coverage * 70 + matched.length * 5;
  const activity = needles.find((word) => ACTIVITY_ROOTS.some((root) => word.startsWith(root)));
  if (activity && serviceWords.some((word) => rootsMatch(activity, word))) points += 25;
  return points;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(
        above + 1,
        previous[j - 1]! + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length]!;
}

function typoSuggestion(query: string): string | null {
  if (!query || query.includes(" ") || query.length < 5) return null;
  const candidates = new Set<string>();
  for (const specialty of SPECIALTIES) candidates.add(normalize(specialty.name));
  for (const service of SERVICE_INDEX) {
    candidates.add(service.search.name);
    for (const alias of service.search.aliases) candidates.add(alias);
  }
  let best: { value: string; distance: number } | null = null;
  for (const value of candidates) {
    if (value.includes(" ") || Math.abs(value.length - query.length) > 2) continue;
    const distance = editDistance(query, value);
    // Una transposición común ("plomreo") cuesta dos ediciones en Levenshtein.
    const maximum = query.length >= 6 ? 2 : 1;
    if (distance <= maximum && (!best || distance < best.distance)) best = { value, distance };
  }
  return best?.value ?? null;
}

function inferredMode(query: string): ServiceModeCode | null {
  if (/\b(a domicilio|en casa|venga a casa|hasta casa)\b/.test(query)) return "at_customer";
  if (/\b(online|remoto|a distancia|videollamada)\b/.test(query)) return "remote";
  if (/\b(en (su|el) local|en tienda)\b/.test(query)) return "at_business";
  return null;
}

export function interpretSearchQuery(original: string): SearchQueryPlan {
  const normalized = normalize(original).slice(0, 200);
  if (!normalized) {
    return { original, normalized, phrases: [], coreTerms: [], specialtyIds: [], allowSpecialtyMatch: false,
      label: null, suggestedQuery: null, inferredMode: null, exclusions: [] };
  }

  const queryWords = words(normalized);
  const exclusions = queryWords.flatMap((word, index) =>
    NEGATIONS.has(word) && queryWords[index + 1] ? [queryWords[index + 1]!] : [],
  );
  const needles = meaningful(normalized).filter((word) => !exclusions.includes(word));
  const forcedIds = SEARCH_NEEDS.filter((need) =>
    need.patterns.some((pattern) => normalized.includes(pattern)),
  ).flatMap((need) => need.serviceIds);

  const ranked = SERVICE_INDEX.map((service) => ({
    service,
    score: forcedIds.includes(service.id) ? 200 : scoreService(service, normalized, needles),
  })).filter((entry) => entry.score >= 48).sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name, "es"));

  const bestScore = ranked[0]?.score ?? 0;
  const concepts = ranked.filter((entry) => entry.score >= bestScore - 12).slice(0, 4).map((entry) => entry.service);
  const occupationSpecialty = OCCUPATION_SPECIALTIES[normalized];
  const aliasSpecialties = [...new Set(SERVICE_INDEX.filter((service) =>
    service.search.aliases.includes(normalized),
  ).map((service) => service.specialtyId))];
  const occupationAlias = queryWords.length <= 2 &&
    /(ista|ero|era|ologo|ologa|grafo|grafa|tecnico|tecnica|abogado|abogada|contador|contadora)$/.test(normalized) &&
    aliasSpecialties.length === 1
    ? aliasSpecialties[0]
    : undefined;
  const conceptSpecialties = [...new Set(concepts.map((service) => service.specialtyId))];
  const occupationConcept = queryWords.length === 1 &&
    /(ista|ero|era|ologo|ologa|grafo|grafa|tecnico|tecnica|abogado|abogada|contador|contadora)$/.test(normalized) &&
    conceptSpecialties.length === 1
    ? conceptSpecialties[0]
    : undefined;
  const exactSpecialty = SPECIALTIES.find((specialty) => normalize(specialty.name) === normalized)?.id;
  const exactSector = SERVICE_SECTORS.find((sector) =>
    normalize(sector.name) === normalized || normalize(sector.short) === normalized,
  );
  const sectorSpecialties = exactSector
    ? SPECIALTIES.filter((specialty) => specialty.serviceSectorId === exactSector.id).map((specialty) => specialty.id)
    : [];
  const allowSpecialtyMatch = Boolean(occupationSpecialty || occupationAlias || occupationConcept || exactSpecialty || exactSector);
  const specialtyIds = [...new Set([
    ...(occupationSpecialty ? [occupationSpecialty] : []),
    ...(occupationAlias ? [occupationAlias] : []),
    ...(occupationConcept ? [occupationConcept] : []),
    ...(exactSpecialty ? [exactSpecialty] : []),
    ...sectorSpecialties,
    ...concepts.map((service) => service.specialtyId),
  ])].slice(0, 8);

  const phrases = [...new Set([
    normalized,
    ...concepts.flatMap((service) => [
      service.name,
      ...service.aliases.filter((alias) => {
        const value = normalize(alias);
        return value.includes(" ") || value.length >= 7;
      }),
    ]).map(normalize),
  ])].filter((value) => value.length >= 3).slice(0, 16);

  const conceptTokens = new Set(concepts.flatMap((service) => meaningful(service.name)));
  const coreTerms = needles.filter((word) =>
    conceptTokens.size === 0 || [...conceptTokens].some((candidate) => rootsMatch(word, candidate)),
  ).slice(0, 5);

  const label = occupationSpecialty || occupationAlias || occupationConcept || exactSpecialty
    ? getSpecialty(occupationSpecialty ?? occupationAlias ?? occupationConcept ?? exactSpecialty ?? "")?.name ?? null
    : concepts[0]?.name ?? exactSector?.short ?? null;

  return {
    original: original.slice(0, 200), normalized, phrases, coreTerms, specialtyIds,
    allowSpecialtyMatch, label, suggestedQuery: ranked.length === 0 ? typoSuggestion(normalized) : null,
    inferredMode: inferredMode(normalized), exclusions,
  };
}
