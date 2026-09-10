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
