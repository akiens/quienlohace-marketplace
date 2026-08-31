/** Identificador aleatorio. `crypto.randomUUID` existe en Workers y en Node 24. */
export function newId(): string {
  return crypto.randomUUID();
}
