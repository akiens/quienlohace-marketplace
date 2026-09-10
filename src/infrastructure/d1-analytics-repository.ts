import "server-only";

import type { AnalyticsRepository } from "@/domain/ports";
import type { AnalyticsIngestResult, AnalyticsSegment, StoredAnalyticsEvent } from "@/domain/analytics";
import { getAnalyticsDb } from "@/infrastructure/cloudflare";
import { queryLengthBucket, sanitizeSearchQuery } from "@/lib/analytics/privacy";

export class AnalyticsConflictError extends Error {}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nullable(value: string | undefined): string | null {
  return value ?? null;
}

function centralProperties(event: StoredAnalyticsEvent): { json: string; queryStatement: D1PreparedStatement | null } {
  if (event.eventName === "search_filter_applied") {
    const properties = structuredClone(event.properties) as { before: Record<string, unknown>; after: Record<string, unknown> } & Record<string, unknown>;
    properties.queryChanged = properties.before.query !== properties.after.query;
    delete properties.before.query;
    delete properties.after.query;
    return { json: JSON.stringify(properties), queryStatement: null };
  }
  if (event.eventName !== "search_submitted") return { json: JSON.stringify(event.properties), queryStatement: null };
  const properties = structuredClone(event.properties) as { filters: Record<string, unknown> } & Record<string, unknown>;
  const raw = typeof properties.filters.query === "string" ? properties.filters.query : "";
  const query = sanitizeSearchQuery(raw);
  delete properties.filters.query;
  properties.queryCaptureStatus = query.status;
  properties.queryLengthBucket = queryLengthBucket(raw.trim().length);
  properties.queryRedactionCode = query.redactionCode;
  const statement = getAnalyticsDb().prepare(`INSERT OR IGNORE INTO analytics_search_queries
    (event_id, search_id, query_sanitized, query_normalized, query_tokens_json, capture_status, redaction_code, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))`).bind(
      event.eventId, event.searchId ?? null, query.sanitized, query.normalized,
      query.status === "captured" ? JSON.stringify(query.tokens) : null, query.status, query.redactionCode,
    );
  return { json: JSON.stringify(properties), queryStatement: statement };
}

export class D1AnalyticsRepository implements AnalyticsRepository {
  async ingestBrowserSegment(
    segment: AnalyticsSegment,
    context: { receivedAt: string; countryCode: string | null; regionCode: string | null; payloadHash: string; internalProfileIds: string[]; suspicious: boolean },
  ): Promise<AnalyticsIngestResult> {
    const db = getAnalyticsDb();
    const existingSegment = await db.prepare("SELECT payload_hash FROM analytics_segments WHERE segment_id = ?").bind(segment.segmentId).first<{ payload_hash: string }>();
    if (existingSegment) {
      if (existingSegment.payload_hash !== context.payloadHash) throw new AnalyticsConflictError("segment_payload_conflict");
      return { accepted: [], duplicated: segment.events.map((event) => event.eventId) };
    }

    const existingRows: Array<{ event_id: string; payload_hash: string }> = [];
    for (let index = 0; index < segment.events.length; index += 80) {
      const ids = segment.events.slice(index, index + 80).map((event) => event.eventId);
      const chunk = await db.prepare(`SELECT event_id, payload_hash FROM analytics_events WHERE event_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ event_id: string; payload_hash: string }>();
      existingRows.push(...chunk.results);
    }
    const hashes = new Map<string, string>();
    for (const event of segment.events) hashes.set(event.eventId, await sha256(JSON.stringify(event)));
    for (const row of existingRows) {
      if (hashes.get(row.event_id) !== row.payload_hash) throw new AnalyticsConflictError("event_payload_conflict");
    }
    const duplicateIds = new Set(existingRows.map((row) => row.event_id));
    const fresh = segment.events.filter((event) => !duplicateIds.has(event.eventId));

    const statements: D1PreparedStatement[] = [
      db.prepare(`INSERT INTO analytics_segments
        (segment_id, session_id, tab_id, segment_sequence, started_at, ended_at, last_activity_at, close_reason, schema_version, event_count, dropped_events, payload_hash, received_at, country_code, region_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        segment.segmentId, segment.sessionId, segment.tabId, segment.segmentSequence, segment.startedAt, segment.endedAt,
        segment.lastActivityAt, segment.closeReason, segment.schemaVersion, segment.events.length, segment.droppedEvents,
        context.payloadHash, context.receivedAt, context.countryCode, context.regionCode,
      ),
      db.prepare(`INSERT INTO analytics_sessions
        (session_id, first_received_at, last_received_at, first_occurred_at, last_occurred_at, capture_policy_version)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET
        last_received_at = excluded.last_received_at, last_occurred_at = MAX(last_occurred_at, excluded.last_occurred_at)`).bind(
        segment.sessionId, context.receivedAt, context.receivedAt, segment.startedAt, segment.endedAt,
        fresh[0]?.capturePolicyVersion ?? 1,
      ),
    ];

    for (const event of fresh) {
      const property = centralProperties(event);
      statements.push(db.prepare(`INSERT INTO analytics_events (
        event_id, segment_id, event_name, schema_version, collector_version, app_release, environment,
        occurred_at, received_at, client_sequence, monotonic_ms, source, observation_kind,
        session_id, tab_id, page_view_id, previous_page_view_id, search_id, previous_search_id,
        search_execution_id, result_set_id, list_view_id, result_item_id, impression_id, interaction_id, source_interaction_id,
        entity_type, provider_profile_id, profile_service_id, service_card_id, specialty_id, service_sector_id, entity_snapshot_id,
        page_type, surface, component_id, placement, ui_version, privacy_policy_version, capture_policy_version,
        country_code, region_code, sample_rate, time_quality, entity_resolution_status, is_internal, is_suspicious, properties_json, payload_hash
      ) VALUES (${Array.from({ length: 49 }, () => "?").join(",")})`).bind(
        event.eventId, segment.segmentId, event.eventName, event.schemaVersion, event.collectorVersion, event.appRelease, event.environment,
        event.occurredAt, context.receivedAt, event.clientSequence, event.monotonicMs, event.source, event.observationKind,
        event.sessionId, event.tabId, nullable(event.pageViewId), nullable(event.previousPageViewId), nullable(event.searchId), nullable(event.previousSearchId),
        nullable(event.searchExecutionId), nullable(event.resultSetId), nullable(event.listViewId), nullable(event.resultItemId), nullable(event.impressionId), nullable(event.interactionId), nullable(event.sourceInteractionId),
        nullable(event.entityType), nullable(event.providerProfileId), nullable(event.profileServiceId), nullable(event.serviceCardId), nullable(event.specialtyId), nullable(event.serviceSectorId), nullable(event.entitySnapshotId),
        nullable(event.pageType), nullable(event.surface), nullable(event.componentId), nullable(event.placement), event.uiVersion, event.privacyPolicyVersion, event.capturePolicyVersion,
        context.countryCode, context.regionCode, event.sampleRate,
        Date.parse(context.receivedAt) - Date.parse(event.occurredAt) > 60 * 60_000 ? "late" : "client_clock",
        event.serviceCardId || event.providerProfileId ? "verified" : "not_applicable",
        event.providerProfileId && context.internalProfileIds.includes(event.providerProfileId) ? 1 : 0,
        context.suspicious ? 1 : 0, property.json, hashes.get(event.eventId),
      ));
      if (property.queryStatement) statements.push(property.queryStatement);
    }
    await db.batch(statements);
    return { accepted: fresh.map((event) => event.eventId), duplicated: [...duplicateIds] };
  }
}

export type ServerSearchItem = {
  resultItemId: string;
  position: number;
  resultKind: "profile" | "service";
  providerProfileId: string;
  profileServiceId: string | null;
  serviceCardId: string | null;
  specialtyId: string | null;
  snapshotId: string;
  snapshot: Record<string, unknown>;
  matchReason: string;
};

export async function recordServerSearch(input: {
  searchId: string;
  executionId: string;
  resultSetId: string;
  executedAt: string;
  durationMs: number;
  total: number;
  providerTotal: number;
  interpretation: Record<string, unknown>;
  items: ServerSearchItem[];
}): Promise<void> {
  const db = getAnalyticsDb();
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO analytics_search_executions
      (search_execution_id, search_id, result_set_id, executed_at, duration_ms, status, total_results, provider_total, ranking_version, interpretation_json)
      VALUES (?, ?, ?, ?, ?, 'success', ?, ?, 'mixed-v1', ?)`).bind(
      input.executionId, input.searchId, input.resultSetId, input.executedAt, input.durationMs,
      input.total, input.providerTotal, JSON.stringify(input.interpretation),
    ),
    db.prepare(`INSERT INTO analytics_result_sets
      (result_set_id, search_execution_id, created_at, total_count, delivered_count, ranking_version)
      VALUES (?, ?, ?, ?, ?, 'mixed-v1')`).bind(
      input.resultSetId, input.executionId, input.executedAt, input.total, input.items.length,
    ),
  ];
  for (const item of input.items) {
    statements.push(
      db.prepare(`INSERT OR IGNORE INTO analytics_entity_snapshots
        (snapshot_id, entity_type, entity_id, schema_version, valid_from, attributes_json)
        VALUES (?, ?, ?, 1, ?, ?)`).bind(
        item.snapshotId, item.resultKind === "service" ? "service_card" : "provider_profile",
        item.serviceCardId ?? item.providerProfileId, input.executedAt, JSON.stringify(item.snapshot),
      ),
      db.prepare(`INSERT INTO analytics_result_items
        (result_item_id, result_set_id, position, result_kind, provider_profile_id, profile_service_id, service_card_id, specialty_id, entity_snapshot_id, placement, match_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'organic', ?)`).bind(
        item.resultItemId, input.resultSetId, item.position, item.resultKind, item.providerProfileId,
        item.profileServiceId, item.serviceCardId, item.specialtyId, item.snapshotId, item.matchReason,
      ),
    );
  }
  await db.batch(statements);
}
