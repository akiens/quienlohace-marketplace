export const ANALYTICS_SCHEMA_VERSION = 1;
export const ANALYTICS_CAPTURE_POLICY_VERSION = 1;
export const ANALYTICS_PRIVACY_POLICY_VERSION = 1;
export const ANALYTICS_COLLECTOR_VERSION = "web-1";

export type AnalyticsEntity = {
  entityType?: "provider_profile" | "profile_service" | "service_card";
  providerProfileId?: string;
  profileServiceId?: string;
  serviceCardId?: string;
  specialtyId?: string;
  serviceSectorId?: string;
  entitySnapshotId?: string;
};

export type AnalyticsEventName =
  | "page_view"
  | "page_activity"
  | "visibility_changed"
  | "scroll_milestone"
  | "section_impression"
  | "search_submitted"
  | "search_filter_applied"
  | "search_results_viewed"
  | "list_viewed"
  | "result_impression"
  | "result_clicked"
  | "contact_clicked"
  | "gallery_opened"
  | "gallery_item_viewed"
  | "analytics_delivery_summary";

export type StoredAnalyticsEvent = AnalyticsEntity & {
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: number;
  collectorVersion: string;
  appRelease: string;
  environment: "development" | "preview" | "production";
  occurredAt: string;
  clientSequence: number;
  monotonicMs: number;
  source: "browser";
  observationKind: "navigation" | "activity" | "impression" | "interaction" | "client_observation";
  sessionId: string;
  tabId: string;
  pageViewId?: string;
  previousPageViewId?: string;
  searchId?: string;
  previousSearchId?: string;
  searchExecutionId?: string;
  resultSetId?: string;
  listViewId?: string;
  resultItemId?: string;
  impressionId?: string;
  interactionId?: string;
  sourceInteractionId?: string;
  pageType?: string;
  surface?: string;
  componentId?: string;
  placement?: string;
  uiVersion: string;
  privacyPolicyVersion: number;
  capturePolicyVersion: number;
  sampleRate: number;
  properties: Record<string, unknown>;
};

export type AnalyticsSegment = {
  segmentId: string;
  /** Credencial efimera firmada; se valida al ingresar y nunca se persiste. */
  ingestionToken: string;
  sessionId: string;
  tabId: string;
  segmentSequence: number;
  startedAt: string;
  endedAt: string;
  lastActivityAt: string;
  closeReason: "interval" | "size_limit" | "hidden" | "pagehide" | "session_timeout" | "manual";
  schemaVersion: number;
  events: StoredAnalyticsEvent[];
  droppedEvents: number;
};

export type AnalyticsIngestResult = {
  accepted: string[];
  duplicated: string[];
};
