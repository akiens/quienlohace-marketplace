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
 * Ordena cartas y perfiles en una lista única. La evidencia manda; dentro de
 * cada nivel se da una aparición a cada proveedor antes de repetirlo.
 */
export function rankMixedSearchResults<T extends {
  providerId: string;
  kind: "service" | "profile";
  match: { level: "explicit" | "specialty" | "discovery"; relevance: number };
}>(items: T[], quality: (item: T) => number): T[] {
  const levels = ["explicit", "specialty", "discovery"] as const;
  const result: T[] = [];

  for (const level of levels) {
    const candidates = items.filter((item) => item.match.level === level);
    const byProvider = new Map<string, T[]>();
    for (const item of candidates) {
      const queue = byProvider.get(item.providerId);
      if (queue) queue.push(item);
      else byProvider.set(item.providerId, [item]);
    }

    const score = (item: T) => item.match.relevance * 100 + quality(item);
    for (const queue of byProvider.values()) {
      queue.sort((left, right) =>
        (left.kind === right.kind ? 0 : left.kind === "service" ? -1 : 1)
        || score(right) - score(left));
    }

    const providers = [...byProvider.entries()].sort((left, right) => {
      const leftBest = Math.max(...left[1].map(score));
      const rightBest = Math.max(...right[1].map(score));
      return rightBest - leftBest || left[0].localeCompare(right[0]);
    });

    let pending = true;
    while (pending) {
      pending = false;
      for (const [, queue] of providers) {
        const item = queue.shift();
        if (!item) continue;
        result.push(item);
        pending = true;
      }
    }
  }
  return result;
}
