import { analyticsEnabled, getAnalyticsDb, getAnalyticsSessionSecret, getDb } from "@/infrastructure/cloudflare";
import { AnalyticsConflictError, D1AnalyticsRepository } from "@/infrastructure/d1-analytics-repository";
import { inspectAnalyticsSegment } from "@/lib/analytics/ingestion-guard";
import { hasAllowedAnalyticsOrigin } from "@/lib/analytics/request-guard";
import { analyticsSegmentSchema } from "@/lib/analytics/schema";
import { verifyAnalyticsSession } from "@/lib/analytics/session-token";
import type { AnalyticsSegment } from "@/domain/analytics";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SEGMENTS_PER_TEN_MINUTES = 30;
const MAX_EVENTS_PER_TEN_MINUTES = 500;
const MAX_TABS_PER_TEN_MINUTES = 10;

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validBusinessReferences(events: Array<{ serviceCardId?: string; providerProfileId?: string; profileServiceId?: string; specialtyId?: string }>): Promise<boolean> {
  type Check = { kind: "card" | "service" | "profile"; id: string; profile?: string; service?: string; specialty?: string };
  const checks = new Map<string, Check>();
  for (const event of events) {
    if (event.serviceCardId) checks.set(`card:${event.serviceCardId}`, { kind: "card", id: event.serviceCardId, profile: event.providerProfileId, service: event.profileServiceId, specialty: event.specialtyId });
    else if (event.profileServiceId) checks.set(`service:${event.profileServiceId}`, { kind: "service", id: event.profileServiceId, profile: event.providerProfileId, specialty: event.specialtyId });
    else if (event.providerProfileId) checks.set(`profile:${event.providerProfileId}`, { kind: "profile", id: event.providerProfileId });
  }
  if (!checks.size) return true;
  const db = getDb();
  const ordered = [...checks.values()];
  const results = await db.batch(ordered.map((item) => db.prepare(
    item.kind === "card"
      ? "SELECT sc.profile_id, sc.service_id, s.specialty_id FROM service_cards sc JOIN services s ON s.id = sc.service_id AND s.profile_id = sc.profile_id WHERE sc.id = ? LIMIT 1"
      : item.kind === "service"
        ? "SELECT profile_id, id AS service_id, specialty_id FROM services WHERE id = ? LIMIT 1"
        : "SELECT id AS profile_id FROM profiles WHERE id = ? LIMIT 1",
  ).bind(item.id)));
  return ordered.every((expected, index) => {
    const row = results[index]?.results?.[0] as { profile_id?: string; service_id?: string; specialty_id?: string } | undefined;
    return Boolean(row && (!expected.profile || row.profile_id === expected.profile) && (!expected.service || row.service_id === expected.service) && (!expected.specialty || row.specialty_id === expected.specialty));
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!analyticsEnabled()) return new Response(null, { status: 204 });
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });
  if (!hasAllowedAnalyticsOrigin(request)) return Response.json({ error: "origin_rejected" }, { status: 403 });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = analyticsSegmentSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "invalid_contract" }, { status: 422 });
  const receivedAt = Date.now();
  if (parsed.data.events.some((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return !Number.isFinite(occurredAt) || occurredAt < receivedAt - 48 * 60 * 60_000 || occurredAt > receivedAt + 10 * 60_000;
  })) return Response.json({ error: "invalid_event_time" }, { status: 422 });

  const secret = getAnalyticsSessionSecret();
  if (!secret) return Response.json({ error: "analytics_session_unavailable" }, { status: 503 });
  const session = await verifyAnalyticsSession(parsed.data.ingestionToken, secret, receivedAt);
  if (!session || session.sessionId !== parsed.data.sessionId) {
    return Response.json({ error: "invalid_analytics_session" }, { status: 401 });
  }
  const inspection = inspectAnalyticsSegment(parsed.data as AnalyticsSegment);
  if (!inspection.accepted) return Response.json({ error: inspection.code }, { status: 422 });

  try {
    const recent = await getAnalyticsDb().prepare(`SELECT COUNT(*) AS segment_count,
      COALESCE(SUM(event_count), 0) AS event_count,
      COUNT(DISTINCT tab_id) AS tab_count,
      MAX(CASE WHEN tab_id = ? THEN 1 ELSE 0 END) AS known_tab
      FROM analytics_segments
      WHERE session_id = ? AND julianday(received_at) >= julianday('now', '-10 minutes')`)
      .bind(parsed.data.tabId, parsed.data.sessionId)
      .first<{ segment_count: number; event_count: number; tab_count: number; known_tab: number | null }>();
    const exceedsSessionBudget = (recent?.segment_count ?? 0) >= MAX_SEGMENTS_PER_TEN_MINUTES
      || (recent?.event_count ?? 0) + parsed.data.events.length > MAX_EVENTS_PER_TEN_MINUTES
      || ((recent?.known_tab ?? 0) === 0 && (recent?.tab_count ?? 0) >= MAX_TABS_PER_TEN_MINUTES);
    if (exceedsSessionBudget) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
    if (!(await validBusinessReferences(parsed.data.events))) return Response.json({ error: "invalid_entity_relationship" }, { status: 422 });
    const user = await getCurrentUser();
    const ownProfiles = user
      ? await getDb().prepare("SELECT id FROM profiles WHERE user_id = ?").bind(user.id).all<{ id: string }>()
      : { results: [] };
    const cf = (request as Request & { cf?: { country?: string; regionCode?: string } }).cf;
    const result = await new D1AnalyticsRepository().ingestBrowserSegment(parsed.data as AnalyticsSegment, {
      receivedAt: new Date(receivedAt).toISOString(), countryCode: cf?.country?.slice(0, 2) ?? null,
      regionCode: cf?.regionCode?.slice(0, 8) ?? null, payloadHash: await digest(raw),
      internalProfileIds: ownProfiles.results.map((profile) => profile.id),
      suspicious: inspection.suspicious,
    });
    return Response.json(result, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AnalyticsConflictError) return Response.json({ error: error.message }, { status: 409 });
    console.error("analytics ingestion failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
    return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
