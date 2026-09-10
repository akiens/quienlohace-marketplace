import assert from "node:assert/strict";

import type { AnalyticsSegment, StoredAnalyticsEvent } from "../src/domain/analytics";
import { sanitizeSearchQuery } from "../src/lib/analytics/privacy";
import { analyticsSegmentSchema } from "../src/lib/analytics/schema";
import { inspectAnalyticsSegment } from "../src/lib/analytics/ingestion-guard";
import { issueAnalyticsSession, verifyAnalyticsSession } from "../src/lib/analytics/session-token";

async function main() {
const secret = "analytics-check-secret-with-at-least-32-bytes";
const issuedAt = Date.parse("2026-09-10T11:59:00.000Z");
const session = await issueAnalyticsSession(secret, issuedAt);
assert.equal((await verifyAnalyticsSession(session.token, secret, issuedAt + 1_000))?.sessionId, session.claims.sessionId);
const tampered = `${session.token.slice(0, -1)}${session.token.endsWith("a") ? "b" : "a"}`;
assert.equal(await verifyAnalyticsSession(tampered, secret, issuedAt + 1_000), null);
assert.equal(await verifyAnalyticsSession(session.token, secret, issuedAt + 24 * 60 * 60_000), null);

assert.equal(sanitizeSearchQuery("  Plomero en Pocitos ").normalized, "plomero en pocitos");
assert.equal(sanitizeSearchQuery("llamar al 099 123 456").status, "redacted");
assert.equal(sanitizeSearchQuery("correo persona@example.com").sanitized, null);
assert.equal(sanitizeSearchQuery("https://example.com/algo").redactionCode, "url");
assert.equal(sanitizeSearchQuery("electricista en avenida Italia 1234").redactionCode, "address");

const base: StoredAnalyticsEvent = {
  eventId: "event_00000000-0000-4000-8000-000000000001", eventName: "contact_clicked",
  schemaVersion: 1, collectorVersion: "web-1", appRelease: "test", environment: "development",
  occurredAt: "2026-09-10T12:00:00.000Z", clientSequence: 1, monotonicMs: 10,
  source: "browser", observationKind: "interaction", sessionId: "session_1", tabId: "tab_1",
  pageViewId: "view_1", entityType: "service_card", providerProfileId: "profile_1",
  profileServiceId: "service_1", serviceCardId: "card_1", pageType: "service_detail",
  specialtyId: "specialty_1",
  surface: "service_detail_contact", uiVersion: "web-1", privacyPolicyVersion: 1,
  capturePolicyVersion: 1, sampleRate: 1,
  properties: { channel: "whatsapp", action: "open_contact_link" },
};
const segment: AnalyticsSegment = {
  segmentId: "segment_1", ingestionToken: session.token, sessionId: "session_1", tabId: "tab_1", segmentSequence: 1,
  startedAt: "2026-09-10T12:00:00.000Z", endedAt: "2026-09-10T12:00:01.000Z",
  lastActivityAt: "2026-09-10T12:00:00.500Z", closeReason: "hidden", schemaVersion: 1,
  events: [base], droppedEvents: 0,
};
assert.equal(analyticsSegmentSchema.safeParse(segment).success, true);
assert.equal(analyticsSegmentSchema.safeParse({ ...segment, events: [{ ...base, properties: { channel: "whatsapp", action: "open_contact_link", url: "https://wa.me/secret" } }] }).success, false);
assert.equal(analyticsSegmentSchema.safeParse({ ...segment, events: [{ ...base, sessionId: "other" }] }).success, false);
assert.deepEqual(inspectAnalyticsSegment(segment), { accepted: true, suspicious: false });
assert.equal(inspectAnalyticsSegment({
  ...segment,
  events: [{ ...base, eventName: "page_activity", observationKind: "activity", properties: { visibleMs: 10, activeMs: 20, activitySequence: 1 } }],
}).accepted, false);

console.log("analytics checks passed");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
