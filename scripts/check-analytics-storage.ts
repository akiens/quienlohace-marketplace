import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

import type { AnalyticsSegment } from "../src/domain/analytics";

async function main() {
  (globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  await initOpenNextCloudflareForDev();
  const [{ AnalyticsConflictError, D1AnalyticsRepository, recordServerSearch }, { getAnalyticsDb, getAnalyticsRawBucket }, { runAnalyticsMaintenance }] = await Promise.all([
    import("../src/infrastructure/d1-analytics-repository"),
    import("../src/infrastructure/cloudflare"),
    import("../src/infrastructure/analytics-maintenance"),
  ]);

const now = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
const segment: AnalyticsSegment = {
  segmentId: "segment_storage_check", ingestionToken: "storage-check-token-not-persisted",
  sessionId: "session_storage_check", tabId: "tab_storage_check",
  segmentSequence: 1, startedAt: now, endedAt: now, lastActivityAt: now, closeReason: "manual",
  schemaVersion: 1, droppedEvents: 0,
  events: [{
    eventId: "event_storage_check", eventName: "page_view", schemaVersion: 1,
    collectorVersion: "check", appRelease: "check", environment: "development", occurredAt: now,
    clientSequence: 1, monotonicMs: 1, source: "browser", observationKind: "navigation",
    sessionId: "session_storage_check", tabId: "tab_storage_check", pageViewId: "view_storage_check",
    pageType: "home", uiVersion: "web-1", privacyPolicyVersion: 1, capturePolicyVersion: 1,
    sampleRate: 1, properties: { routeType: "home", navigationSource: "direct" },
  }, {
    eventId: "event_search_storage_check", eventName: "search_submitted", schemaVersion: 1,
    collectorVersion: "check", appRelease: "check", environment: "development", occurredAt: now,
    clientSequence: 2, monotonicMs: 2, source: "browser", observationKind: "interaction",
    sessionId: "session_storage_check", tabId: "tab_storage_check", pageViewId: "view_storage_check",
    searchId: "search_storage_check", pageType: "search_results", surface: "search_results",
    uiVersion: "web-1", privacyPolicyVersion: 1, capturePolicyVersion: 1, sampleRate: 1,
    properties: { reason: "submit", normalizerVersion: 1, filters: { query: "plomero 099 123 456", resultKinds: [], locationIds: [], specialtyIds: [], minRating: null, paymentMethods: [], serviceModes: [], useMyLocation: false } },
  }, {
    eventId: "event_filter_storage_check", eventName: "search_filter_applied", schemaVersion: 1,
    collectorVersion: "check", appRelease: "check", environment: "development", occurredAt: now,
    clientSequence: 3, monotonicMs: 3, source: "browser", observationKind: "interaction",
    sessionId: "session_storage_check", tabId: "tab_storage_check", pageViewId: "view_storage_check",
    searchId: "search_storage_check", pageType: "search_results", surface: "search_results",
    uiVersion: "web-1", privacyPolicyVersion: 1, capturePolicyVersion: 1, sampleRate: 1,
    properties: {
      changedFields: ["locationIds"],
      before: { query: "plomero privado", resultKinds: [], locationIds: [], specialtyIds: [], minRating: null, paymentMethods: [], serviceModes: [], useMyLocation: false },
      after: { query: "plomero privado", resultKinds: [], locationIds: ["montevideo"], specialtyIds: [], minRating: null, paymentMethods: [], serviceModes: [], useMyLocation: false },
    },
  }],
};
const repository = new D1AnalyticsRepository();
const context = { receivedAt: now, countryCode: "UY", regionCode: "MO", payloadHash: "storage_check_hash", internalProfileIds: [], suspicious: false };
  let maintenanceRunId: string | null = null;
  let archiveObjects: Array<{ manifest_id: string; object_key: string }> = [];

  try {
    const first = await repository.ingestBrowserSegment(segment, context);
    const duplicate = await repository.ingestBrowserSegment(segment, context);
    assert.deepEqual(first.accepted, ["event_storage_check", "event_search_storage_check", "event_filter_storage_check"]);
    assert.deepEqual(duplicate.duplicated, ["event_storage_check", "event_search_storage_check", "event_filter_storage_check"]);
    await assert.rejects(
      repository.ingestBrowserSegment({ ...segment, endedAt: new Date(Date.now() + 1_000).toISOString() }, { ...context, payloadHash: "different_hash" }),
      AnalyticsConflictError,
    );
    const row = await getAnalyticsDb().prepare("SELECT event_name, country_code FROM analytics_events WHERE event_id = ?").bind("event_storage_check").first<{ event_name: string; country_code: string }>();
    assert.deepEqual(row, { event_name: "page_view", country_code: "UY" });
    const query = await getAnalyticsDb().prepare("SELECT query_sanitized, capture_status FROM analytics_search_queries WHERE event_id = ?").bind("event_search_storage_check").first<{ query_sanitized: string | null; capture_status: string }>();
    assert.deepEqual(query, { query_sanitized: null, capture_status: "redacted" });
    const central = await getAnalyticsDb().prepare("SELECT properties_json FROM analytics_events WHERE event_id = ?").bind("event_search_storage_check").first<{ properties_json: string }>();
    assert.equal(central?.properties_json.includes("099"), false);
    const filterCentral = await getAnalyticsDb().prepare("SELECT properties_json FROM analytics_events WHERE event_id = ?").bind("event_filter_storage_check").first<{ properties_json: string }>();
    assert.equal(filterCentral?.properties_json.includes("plomero privado"), false);
    await recordServerSearch({
      searchId: "search_server_check", executionId: "execution_server_check", resultSetId: "results_server_check",
      executedAt: now, durationMs: 12, total: 1, providerTotal: 1, interpretation: { normalizerVersion: 1 },
      items: [{
        resultItemId: "result_item_server_check", position: 1, resultKind: "profile",
        providerProfileId: "profile_server_check", profileServiceId: null, serviceCardId: null,
        specialtyId: "specialty_server_check", snapshotId: "snapshot_server_check",
        snapshot: { type: "individual", planId: "cobre" }, matchReason: "specialty",
      }],
    });
    const resultItem = await getAnalyticsDb().prepare("SELECT position, result_kind FROM analytics_result_items WHERE result_item_id = ?").bind("result_item_server_check").first<{ position: number; result_kind: string }>();
    assert.deepEqual(resultItem, { position: 1, result_kind: "profile" });
    const maintenance = await runAnalyticsMaintenance();
    maintenanceRunId = maintenance.runId;
    assert.ok(maintenance.exported >= 3);
    archiveObjects = (await getAnalyticsDb().prepare(`SELECT manifest_id, object_key FROM analytics_archive_manifests
      WHERE manifest_id IN (
        SELECT archived_manifest_id FROM analytics_events WHERE event_id = ?
        UNION SELECT archived_manifest_id FROM analytics_search_executions WHERE search_execution_id = ?
      )`).bind("event_storage_check", "execution_server_check").all<{ manifest_id: string; object_key: string }>()).results;
    assert.ok(archiveObjects.length > 0);
    assert.ok(await getAnalyticsRawBucket().head(archiveObjects[0]!.object_key));
    console.log("analytics storage checks passed");
  } finally {
    const db = getAnalyticsDb();
    if (archiveObjects.length) await getAnalyticsRawBucket().delete(archiveObjects.map((item) => item.object_key));
    await db.batch([
      db.prepare("DELETE FROM analytics_events WHERE event_id IN (?, ?, ?)").bind("event_storage_check", "event_search_storage_check", "event_filter_storage_check"),
      db.prepare("DELETE FROM analytics_segments WHERE segment_id = ?").bind("segment_storage_check"),
      db.prepare("DELETE FROM analytics_sessions WHERE session_id = ?").bind("session_storage_check"),
      db.prepare("DELETE FROM analytics_result_items WHERE result_item_id = ?").bind("result_item_server_check"),
      db.prepare("DELETE FROM analytics_result_sets WHERE result_set_id = ?").bind("results_server_check"),
      db.prepare("DELETE FROM analytics_search_executions WHERE search_execution_id = ?").bind("execution_server_check"),
      db.prepare("DELETE FROM analytics_entity_snapshots WHERE snapshot_id = ?").bind("snapshot_server_check"),
      ...archiveObjects.map((item) => db.prepare("DELETE FROM analytics_archive_manifests WHERE manifest_id = ?").bind(item.manifest_id)),
      db.prepare("DELETE FROM analytics_job_runs WHERE run_id = ?").bind(maintenanceRunId ?? "missing"),
    ]);
  }
}

const keepAlive = setInterval(() => {}, 1_000);
void main().then(
  () => {
    clearInterval(keepAlive);
    process.exit(0);
  },
  (error: unknown) => {
    clearInterval(keepAlive);
    console.error(error);
    process.exit(1);
  },
);
