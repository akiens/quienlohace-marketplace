import "server-only";

import { getAnalyticsDb, getAnalyticsRawBucket } from "@/infrastructure/cloudflare";

type EventExportRow = Record<string, unknown> & { event_id: string; received_at: string };
type ExecutionExportRow = Record<string, unknown> & { search_execution_id: string; result_set_id: string; executed_at: string };

async function relatedRows(db: D1Database, table: string, column: string, ids: string[]): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    const result = await db.prepare(`SELECT * FROM ${table} WHERE ${column} IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all<Record<string, unknown>>();
    rows.push(...result.results);
  }
  return rows;
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function gzip(value: string): Promise<ArrayBuffer> {
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function runAnalyticsMaintenance(): Promise<{
  runId: string;
  exported: number;
  projected: number;
  restrictedPurged: number;
  hotPurged: number;
  archivePurged: number;
}> {
  const db = getAnalyticsDb();
  const bucket = getAnalyticsRawBucket();
  const now = new Date().toISOString();
  const runId = `analytics_job_${crypto.randomUUID()}`;
  await db.prepare("INSERT INTO analytics_job_runs (run_id, job_name, started_at, status) VALUES (?, 'archive_and_retention', ?, 'running')").bind(runId, now).run();

  try {
    const projection = await db.prepare(`INSERT OR REPLACE INTO analytics_daily_query_terms
      (day, query_normalized, query_sanitized, search_count, session_count, zero_result_count, projection_version, calculated_at)
      SELECT substr(e.occurred_at, 1, 10), q.query_normalized, MIN(q.query_sanitized), COUNT(*), COUNT(DISTINCT e.session_id),
        SUM(CASE WHEN x.total_results = 0 THEN 1 ELSE 0 END), 1, ?
      FROM analytics_search_queries q JOIN analytics_events e ON e.event_id = q.event_id
      LEFT JOIN analytics_search_executions x ON x.search_id = e.search_id
      WHERE q.expires_at <= datetime('now', '+1 day') AND q.capture_status = 'captured'
      GROUP BY substr(e.occurred_at, 1, 10), q.query_normalized HAVING COUNT(DISTINCT e.session_id) >= 10`).bind(now).run();

    const eventRows = await db.prepare(`SELECT * FROM analytics_events
      WHERE archived_manifest_id IS NULL AND julianday(received_at) <= julianday('now', '-1 hour')
      ORDER BY received_at, event_id LIMIT 1000`).all<EventExportRow>();
    const executionRows = await db.prepare(`SELECT * FROM analytics_search_executions
      WHERE archived_manifest_id IS NULL AND julianday(executed_at) <= julianday('now', '-1 hour')
      ORDER BY executed_at, search_execution_id LIMIT 250`).all<ExecutionExportRow>();
    let exported = 0;
    if (eventRows.results.length || executionRows.results.length) {
      const segments = await relatedRows(db, "analytics_segments", "segment_id", [...new Set(eventRows.results.map((row) => String(row.segment_id)).filter(Boolean))]);
      const sessions = await relatedRows(db, "analytics_sessions", "session_id", [...new Set(eventRows.results.map((row) => String(row.session_id)).filter(Boolean))]);
      const resultSets = await relatedRows(db, "analytics_result_sets", "search_execution_id", executionRows.results.map((row) => row.search_execution_id));
      const resultItems = await relatedRows(db, "analytics_result_items", "result_set_id", resultSets.map((row) => String(row.result_set_id)));
      const snapshots = await relatedRows(db, "analytics_entity_snapshots", "snapshot_id", [...new Set(resultItems.map((row) => String(row.entity_snapshot_id)).filter(Boolean))]);
      const records = [
        ...eventRows.results.map((data) => ({ recordType: "event", data })),
        ...segments.map((data) => ({ recordType: "segment", data })),
        ...sessions.map((data) => ({ recordType: "session", data })),
        ...executionRows.results.map((data) => ({ recordType: "search_execution", data })),
        ...resultSets.map((data) => ({ recordType: "result_set", data })),
        ...resultItems.map((data) => ({ recordType: "result_item", data })),
        ...snapshots.map((data) => ({ recordType: "entity_snapshot", data })),
      ];
      const ndjson = `${records.map((row) => JSON.stringify(row)).join("\n")}\n`;
      const checksum = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ndjson)));
      const firstTime = eventRows.results[0]?.received_at ?? executionRows.results[0]!.executed_at;
      const cutoff = [eventRows.results.at(-1)?.received_at, executionRows.results.at(-1)?.executed_at].filter((value): value is string => Boolean(value)).sort().at(-1)!;
      const manifestId = `manifest_${checksum.slice(0, 32)}`;
      const hour = String(firstTime).slice(0, 13).replace("T", "-");
      const objectKey = `events/received_hour=${hour}/record_type=mixed/schema=1/${manifestId}.ndjson.gz`;
      const compressed = await gzip(ndjson);
      await bucket.put(objectKey, compressed, { httpMetadata: { contentType: "application/x-ndjson", contentEncoding: "gzip" }, customMetadata: { checksum, eventCount: String(eventRows.results.length), recordCount: String(records.length) } });
      const head = await bucket.head(objectKey);
      if (!head || head.size !== compressed.byteLength) throw new Error("archive_verification_failed");

      const statements: D1PreparedStatement[] = [db.prepare(`INSERT OR IGNORE INTO analytics_archive_manifests
        (manifest_id, object_key, cutoff_received_at, event_count, checksum, schema_version, status, created_at, verified_at)
        VALUES (?, ?, ?, ?, ?, 1, 'verified', ?, ?)`).bind(
        manifestId, objectKey, cutoff, eventRows.results.length, checksum, now, now,
      )];
      for (let index = 0; index < eventRows.results.length; index += 80) {
        const ids = eventRows.results.slice(index, index + 80).map((row) => row.event_id);
        statements.push(db.prepare(`UPDATE analytics_events SET archived_manifest_id = ? WHERE event_id IN (${ids.map(() => "?").join(",")})`).bind(manifestId, ...ids));
      }
      for (let index = 0; index < executionRows.results.length; index += 80) {
        const ids = executionRows.results.slice(index, index + 80).map((row) => row.search_execution_id);
        statements.push(db.prepare(`UPDATE analytics_search_executions SET archived_manifest_id = ? WHERE search_execution_id IN (${ids.map(() => "?").join(",")})`).bind(manifestId, ...ids));
      }
      await db.batch(statements);
      exported = eventRows.results.length;
    }

    const restricted = await db.prepare("DELETE FROM analytics_search_queries WHERE expires_at <= datetime('now')").run();
    const hot = await db.prepare("DELETE FROM analytics_events WHERE archived_manifest_id IS NOT NULL AND julianday(received_at) <= julianday('now', '-14 days')").run();
    await db.prepare(`DELETE FROM analytics_segments WHERE julianday(received_at) <= julianday('now', '-14 days')
      AND NOT EXISTS (SELECT 1 FROM analytics_events e WHERE e.segment_id = analytics_segments.segment_id)`).run();
    await db.prepare(`DELETE FROM analytics_sessions WHERE julianday(last_received_at) <= julianday('now', '-14 days')
      AND NOT EXISTS (SELECT 1 FROM analytics_segments s WHERE s.session_id = analytics_sessions.session_id)
      AND NOT EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = analytics_sessions.session_id)`).run();
    await db.prepare(`DELETE FROM analytics_result_items WHERE result_set_id IN (
      SELECT rs.result_set_id FROM analytics_result_sets rs JOIN analytics_search_executions x ON x.search_execution_id = rs.search_execution_id
      WHERE x.archived_manifest_id IS NOT NULL AND julianday(x.executed_at) <= julianday('now', '-14 days'))`).run();
    await db.prepare(`DELETE FROM analytics_result_sets WHERE search_execution_id IN (
      SELECT search_execution_id FROM analytics_search_executions WHERE archived_manifest_id IS NOT NULL AND julianday(executed_at) <= julianday('now', '-14 days'))`).run();
    await db.prepare("DELETE FROM analytics_search_executions WHERE archived_manifest_id IS NOT NULL AND julianday(executed_at) <= julianday('now', '-14 days')").run();
    await db.prepare(`DELETE FROM analytics_entity_snapshots WHERE julianday(valid_from) <= julianday('now', '-14 days')
      AND NOT EXISTS (SELECT 1 FROM analytics_result_items i WHERE i.entity_snapshot_id = analytics_entity_snapshots.snapshot_id)`).run();
    const expiredArchives = await db.prepare(`SELECT manifest_id, object_key FROM analytics_archive_manifests
      WHERE status = 'verified' AND julianday(cutoff_received_at) <= julianday('now', '-90 days') LIMIT 100`).all<{ manifest_id: string; object_key: string }>();
    if (expiredArchives.results.length) {
      await bucket.delete(expiredArchives.results.map((item) => item.object_key));
      await db.batch(expiredArchives.results.map((item) => db.prepare(
        "UPDATE analytics_archive_manifests SET status = 'expired' WHERE manifest_id = ?",
      ).bind(item.manifest_id)));
    }
    await db.prepare("UPDATE analytics_job_runs SET finished_at = ?, status = 'complete', cursor_value = ? WHERE run_id = ?").bind(
      new Date().toISOString(), eventRows.results.at(-1)?.received_at ?? executionRows.results.at(-1)?.executed_at ?? null, runId,
    ).run();
    return {
      runId,
      exported,
      projected: projection.meta.changes ?? 0,
      restrictedPurged: restricted.meta.changes ?? 0,
      hotPurged: hot.meta.changes ?? 0,
      archivePurged: expiredArchives.results.length,
    };
  } catch (error) {
    await db.prepare("UPDATE analytics_job_runs SET finished_at = ?, status = 'failed', detail_code = ? WHERE run_id = ?").bind(
      new Date().toISOString(), error instanceof Error ? error.message.slice(0, 80) : "unknown", runId,
    ).run();
    throw error;
  }
}
