import { PLAN_RANKS } from "@/domain/plans";
import type { PlanId } from "@/types";

/**
 * Reordena resultados para dar variedad sólo entre candidatos de relevancia
 * cercana. Nunca elimina elementos: si la siguiente carta de un proveedor es
 * claramente mejor, conserva su lugar aunque ese proveedor ya haya aparecido.
 */
export function softlyDiversify<T>(
  items: T[],
  providerId: (item: T) => string,
  score: (item: T) => number,
  relevanceWindow = 8,
): T[] {
  const remaining = [...items].sort((left, right) => score(right) - score(left));
  const appearances = new Map<string, number>();
  const result: T[] = [];

  while (remaining.length > 0) {
    const strongest = remaining[0]!;
    const strongestScore = score(strongest);
    const strongestAppearances = appearances.get(providerId(strongest)) ?? 0;

    /*
     * Entre cartas casi empatadas se elige la del proveedor menos mostrado.
     * La ventana impide que diversidad adelante una coincidencia débil sobre
     * otra claramente mejor.
     */
    let selectedIndex = 0;
    let selectedAppearances = strongestAppearances;
    for (let index = 1; index < remaining.length; index += 1) {
      const candidate = remaining[index]!;
      if (strongestScore - score(candidate) > relevanceWindow) break;
      const count = appearances.get(providerId(candidate)) ?? 0;
      if (count < selectedAppearances) {
        selectedIndex = index;
        selectedAppearances = count;
        if (count === 0) break;
      }
    }

    const [selected] = remaining.splice(selectedIndex, 1);
    result.push(selected!);
    const id = providerId(selected!);
    appearances.set(id, (appearances.get(id) ?? 0) + 1);
  }

  return result;
}

/**
 * Ordena cartas y perfiles según BR-031: plan efectivo, evidencia y rondas
 * por proveedor. Las comparaciones son explícitas para que ninguna suma de
 * puntos permita que un plan inferior adelante a uno superior.
 */
export function rankMixedSearchResults<T extends {
  providerId: string;
  planId: PlanId;
  kind: "service" | "profile";
  match: { level: "explicit" | "specialty" | "discovery"; relevance: number };
}>(
  items: T[],
  quality: (item: T) => number,
  entityId: (item: T) => string,
): T[] {
  const plans: PlanId[] = ["platinum", "gold", "cobre"];
  plans.sort((left, right) => PLAN_RANKS[right] - PLAN_RANKS[left]);
  const levels = ["explicit", "specialty", "discovery"] as const;
  const result: T[] = [];

  for (const planId of plans) {
    for (const level of levels) {
      const candidates = items.filter((item) =>
        item.planId === planId && item.match.level === level);
      const byProvider = new Map<string, T[]>();
      for (const item of candidates) {
        const queue = byProvider.get(item.providerId);
        if (queue) queue.push(item);
        else byProvider.set(item.providerId, [item]);
      }

      for (const queue of byProvider.values()) {
        queue.sort((left, right) =>
          (left.kind === right.kind ? 0 : left.kind === "service" ? -1 : 1)
          || right.match.relevance - left.match.relevance
          || quality(right) - quality(left)
          || entityId(left).localeCompare(entityId(right)));
      }

      const providers = [...byProvider.entries()].sort((left, right) => {
        const leftRelevance = Math.max(...left[1].map((item) => item.match.relevance));
        const rightRelevance = Math.max(...right[1].map((item) => item.match.relevance));
        const leftQuality = Math.max(...left[1].map(quality));
        const rightQuality = Math.max(...right[1].map(quality));
        return rightRelevance - leftRelevance
          || rightQuality - leftQuality
          || left[0].localeCompare(right[0]);
      });

      for (let round = 0; ; round += 1) {
        let added = false;
        for (const [, queue] of providers) {
          const item = queue[round];
          if (!item) continue;
          result.push(item);
          added = true;
        }
        if (!added) break;
      }
    }
  }
  return result;
}
