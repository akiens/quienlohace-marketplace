import type { AnalyticsSegment } from "@/domain/analytics";

const MAX_SEGMENT_DURATION_MS = 10 * 60_000;
const EVENT_TIME_TOLERANCE_MS = 60_000;

export type AnalyticsSegmentInspection =
  | { accepted: false; code: string }
  | { accepted: true; suspicious: boolean };

export function inspectAnalyticsSegment(segment: AnalyticsSegment): AnalyticsSegmentInspection {
  const startedAt = Date.parse(segment.startedAt);
  const endedAt = Date.parse(segment.endedAt);
  const lastActivityAt = Date.parse(segment.lastActivityAt);
  if (startedAt > endedAt || endedAt - startedAt > MAX_SEGMENT_DURATION_MS) {
    return { accepted: false, code: "invalid_segment_window" };
  }
  if (lastActivityAt > endedAt + EVENT_TIME_TOLERANCE_MS) {
    return { accepted: false, code: "invalid_activity_time" };
  }

  let previousSequence = 0;
  let previousMonotonic = -1;
  let pageViews = 0;
  let interactions = 0;
  const pageViewIds = new Set<string>();
  for (const event of segment.events) {
    const occurredAt = Date.parse(event.occurredAt);
    if (occurredAt < startedAt - EVENT_TIME_TOLERANCE_MS || occurredAt > endedAt + EVENT_TIME_TOLERANCE_MS) {
      return { accepted: false, code: "event_outside_segment" };
    }
    if (event.clientSequence <= previousSequence || event.monotonicMs < previousMonotonic) {
      return { accepted: false, code: "invalid_event_sequence" };
    }
    if (event.eventName === "page_activity") {
      const properties = event.properties as { activeMs?: number; visibleMs?: number };
      if ((properties.activeMs ?? 0) > (properties.visibleMs ?? 0)) {
        return { accepted: false, code: "invalid_activity_duration" };
      }
    }
    if (event.eventName === "search_results_viewed") {
      const properties = event.properties as { total?: number; providerTotal?: number; presentedCount?: number };
      if ((properties.providerTotal ?? 0) > (properties.total ?? 0) || (properties.presentedCount ?? 0) > (properties.total ?? 0)) {
        return { accepted: false, code: "invalid_result_counts" };
      }
    }
    if (event.eventName === "page_view") pageViews += 1;
    if (event.observationKind === "interaction") interactions += 1;
    if (event.pageViewId) pageViewIds.add(event.pageViewId);
    previousSequence = event.clientSequence;
    previousMonotonic = event.monotonicMs;
  }

  return {
    accepted: true,
    suspicious: pageViews > 10 || interactions > 30 || pageViewIds.size > 15,
  };
}
