const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL = /(?:https?:\/\/|www\.)\S+/i;
const PHONE = /(?:\+?\d[\s().-]*){8,}/;
const URUGUAY_DOCUMENT = /\b\d[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d\b/;
const ADDRESS = /\b(?:calle|avenida|av\.?|ruta|camino|bulevar|boulevard|pasaje)\s+[\p{L}0-9 .'-]{1,60}\s\d{1,5}\b/iu;

export type SanitizedQuery = {
  status: "captured" | "redacted" | "empty";
  sanitized: string | null;
  normalized: string | null;
  tokens: string[];
  redactionCode: "email" | "url" | "phone" | "document" | "address" | null;
};

/**
 * Nunca devuelve una versión parcialmente censurada: si una frase parece
 * contener un dato personal se elimina completa, incluida cualquier copia
 * previa. Es deliberadamente conservador porque el texto es dataset restringido.
 */
export function sanitizeSearchQuery(input: string): SanitizedQuery {
  const sanitized = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!sanitized) return { status: "empty", sanitized: null, normalized: null, tokens: [], redactionCode: null };

  const checks = [
    [EMAIL, "email"],
    [URL, "url"],
    [URUGUAY_DOCUMENT, "document"],
    [PHONE, "phone"],
    [ADDRESS, "address"],
  ] as const;
  for (const [pattern, code] of checks) {
    if (pattern.test(sanitized)) {
      return { status: "redacted", sanitized: null, normalized: null, tokens: [], redactionCode: code };
    }
  }

  const normalized = sanitized.toLocaleLowerCase("es-UY").normalize("NFKC");
  const tokens = normalized.split(/\s+/).filter(Boolean).slice(0, 30);
  return { status: "captured", sanitized, normalized, tokens, redactionCode: null };
}

export function queryLengthBucket(length: number): "0" | "1-20" | "21-50" | "51-100" | "101-200" {
  if (length === 0) return "0";
  if (length <= 20) return "1-20";
  if (length <= 50) return "21-50";
  if (length <= 100) return "51-100";
  return "101-200";
}
