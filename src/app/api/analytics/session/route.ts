import { analyticsEnabled, getAnalyticsSessionSecret } from "@/infrastructure/cloudflare";
import { hasAllowedAnalyticsOrigin } from "@/lib/analytics/request-guard";
import { issueAnalyticsSession, verifyAnalyticsSession } from "@/lib/analytics/session-token";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1024;

export async function POST(request: Request): Promise<Response> {
  if (!analyticsEnabled()) return new Response(null, { status: 204 });
  if (!hasAllowedAnalyticsOrigin(request)) return Response.json({ error: "origin_rejected" }, { status: 403 });
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let input: { existingToken?: string; rotate?: boolean };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    if (Object.keys(value).some((key) => !["existingToken", "rotate"].includes(key))) throw new Error("invalid");
    if (value.existingToken !== undefined && (typeof value.existingToken !== "string" || value.existingToken.length > 512)) throw new Error("invalid");
    if (value.rotate !== undefined && typeof value.rotate !== "boolean") throw new Error("invalid");
    input = value;
  } catch {
    return Response.json({ error: "invalid_contract" }, { status: 422 });
  }

  const secret = getAnalyticsSessionSecret();
  if (!secret) return Response.json({ error: "analytics_session_unavailable" }, { status: 503 });
  const existing = input.existingToken && !input.rotate
    ? await verifyAnalyticsSession(input.existingToken, secret)
    : null;
  const session = existing
    ? { token: input.existingToken!, claims: existing }
    : await issueAnalyticsSession(secret);

  return Response.json({
    sessionId: session.claims.sessionId,
    ingestionToken: session.token,
    issuedAt: session.claims.issuedAt,
    expiresAt: session.claims.expiresAt,
  }, { status: 201, headers: { "cache-control": "no-store" } });
}
