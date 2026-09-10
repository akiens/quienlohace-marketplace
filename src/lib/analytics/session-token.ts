const SESSION_TTL_MS = 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const SESSION_ID = /^session_[a-f0-9-]{36}$/i;

export type AnalyticsSessionClaims = {
  version: 1;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  if (new TextEncoder().encode(secret).byteLength < 32) throw new Error("analytics_session_secret_too_short");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issueAnalyticsSession(secret: string, now = Date.now()): Promise<{ token: string; claims: AnalyticsSessionClaims }> {
  const claims: AnalyticsSessionClaims = {
    version: 1,
    sessionId: `session_${crypto.randomUUID()}`,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(payload));
  return { token: `${payload}.${toBase64Url(new Uint8Array(signature))}`, claims };
}

export async function verifyAnalyticsSession(token: string, secret: string, now = Date.now()): Promise<AnalyticsSessionClaims | null> {
  if (token.length > 512) return null;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return null;
  const signature = fromBase64Url(encodedSignature);
  const payloadBytes = fromBase64Url(payload);
  if (!signature || !payloadBytes) return null;
  const valid = await crypto.subtle.verify("HMAC", await signingKey(secret), signature, new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<AnalyticsSessionClaims>;
    if (
      value.version !== 1
      || typeof value.sessionId !== "string"
      || !SESSION_ID.test(value.sessionId)
      || typeof value.issuedAt !== "number"
      || typeof value.expiresAt !== "number"
      || !Number.isSafeInteger(value.issuedAt)
      || !Number.isSafeInteger(value.expiresAt)
      || value.issuedAt > now + MAX_CLOCK_SKEW_MS
      || value.expiresAt <= now
      || value.expiresAt - value.issuedAt !== SESSION_TTL_MS
    ) return null;
    return value as AnalyticsSessionClaims;
  } catch {
    return null;
  }
}
