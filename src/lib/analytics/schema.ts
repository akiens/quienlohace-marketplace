import { z } from "zod";

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
const isoDate = z.string().datetime({ offset: true });
const code = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const idList = z.array(id).max(50);
const ingestionToken = z.string().min(80).max(512).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export const analyticsSearchFiltersSchema = z.object({
  query: z.string().max(200),
  resultKinds: z.array(z.enum(["individual", "business", "service"])).max(3),
  locationIds: idList,
  specialtyIds: idList,
  minRating: z.number().min(0).max(5).nullable(),
  paymentMethods: z.array(z.enum(["cash", "bank_transfer", "debit_card", "credit_card", "other"])).max(5),
  serviceModes: z.array(z.enum(["at_customer", "at_business", "remote"])).max(3),
  useMyLocation: z.boolean(),
}).strict();

const eventProperties = {
  page_view: z.object({ routeType: code, navigationSource: z.enum(["direct", "internal", "history", "restore", "unknown"]) }).strict(),
  page_activity: z.object({ visibleMs: z.number().int().min(0).max(86_400_000), activeMs: z.number().int().min(0).max(86_400_000), activitySequence: z.number().int().min(1) }).strict(),
  visibility_changed: z.object({ state: z.enum(["visible", "hidden"]), reason: z.enum(["visibilitychange", "pagehide", "restore"]) }).strict(),
  scroll_milestone: z.object({ percent: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(90)]), contentHeightRange: z.enum(["short", "medium", "long", "very_long"]) }).strict(),
  section_impression: z.object({ sectionCode: code, thresholdMs: z.number().int().min(250).max(10_000) }).strict(),
  search_submitted: z.object({ filters: analyticsSearchFiltersSchema, reason: z.enum(["submit", "filter", "initial", "suggestion"]), normalizerVersion: z.number().int().min(1) }).strict(),
  search_filter_applied: z.object({ changedFields: z.array(code).min(1).max(8), before: analyticsSearchFiltersSchema, after: analyticsSearchFiltersSchema }).strict(),
  search_results_viewed: z.object({ total: z.number().int().min(0), providerTotal: z.number().int().min(0), presentedCount: z.number().int().min(0) }).strict(),
  list_viewed: z.object({ itemCount: z.number().int().min(0), listType: code }).strict(),
  result_impression: z.object({ position: z.number().int().min(1), pagePosition: z.number().int().min(1), page: z.number().int().min(1), thresholdMs: z.literal(1000), visibleRatio: z.literal(0.5), resultKind: z.enum(["profile", "service"]) }).strict(),
  result_clicked: z.object({ position: z.number().int().min(1), action: z.enum(["open_profile", "open_service"]), resultKind: z.enum(["profile", "service"]), hadImpression: z.boolean() }).strict(),
  contact_clicked: z.object({ channel: z.enum(["whatsapp", "phone", "email", "website", "social"]), action: z.literal("open_contact_link") }).strict(),
  gallery_opened: z.object({ imageSetVersion: id, itemCount: z.number().int().min(1).max(100) }).strict(),
  gallery_item_viewed: z.object({ imageId: id, position: z.number().int().min(1).max(100) }).strict(),
  analytics_delivery_summary: z.object({ droppedEvents: z.number().int().min(0), reason: z.enum(["queue_limit", "event_too_large", "disabled"]) }).strict(),
} as const;

const common = z.object({
  eventId: id,
  schemaVersion: z.literal(1),
  collectorVersion: z.string().min(1).max(32),
  appRelease: z.string().min(1).max(80),
  environment: z.enum(["development", "preview", "production"]),
  occurredAt: isoDate,
  clientSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  monotonicMs: z.number().min(0),
  source: z.literal("browser"),
  observationKind: z.enum(["navigation", "activity", "impression", "interaction", "client_observation"]),
  sessionId: id,
  tabId: id,
  pageViewId: id.optional(), previousPageViewId: id.optional(), searchId: id.optional(), previousSearchId: id.optional(),
  searchExecutionId: id.optional(), resultSetId: id.optional(), listViewId: id.optional(), resultItemId: id.optional(), impressionId: id.optional(),
  interactionId: id.optional(), sourceInteractionId: id.optional(),
  entityType: z.enum(["provider_profile", "profile_service", "service_card"]).optional(),
  providerProfileId: id.optional(), profileServiceId: id.optional(), serviceCardId: id.optional(), specialtyId: id.optional(), serviceSectorId: id.optional(), entitySnapshotId: id.optional(),
  pageType: code.optional(), surface: code.optional(), componentId: code.optional(), placement: code.optional(),
  uiVersion: z.string().min(1).max(32), privacyPolicyVersion: z.literal(1), capturePolicyVersion: z.literal(1), sampleRate: z.number().positive().max(1),
});

const variants = Object.entries(eventProperties).map(([eventName, properties]) =>
  common.extend({ eventName: z.literal(eventName), properties }).strict(),
);

export const analyticsEventSchema = z.discriminatedUnion("eventName", variants as [typeof variants[number], typeof variants[number], ...Array<typeof variants[number]>]);

export const analyticsSegmentSchema = z.object({
  segmentId: id,
  ingestionToken,
  sessionId: id,
  tabId: id,
  segmentSequence: z.number().int().min(1),
  startedAt: isoDate,
  endedAt: isoDate,
  lastActivityAt: isoDate,
  closeReason: z.enum(["interval", "size_limit", "hidden", "pagehide", "session_timeout", "manual"]),
  schemaVersion: z.literal(1),
  events: z.array(analyticsEventSchema).min(1).max(50),
  droppedEvents: z.number().int().min(0),
}).strict().superRefine((segment, ctx) => {
  if (segment.events.some((event) => event.sessionId !== segment.sessionId || event.tabId !== segment.tabId)) {
    ctx.addIssue({ code: "custom", message: "Los eventos no pertenecen al segmento." });
  }
  segment.events.forEach((event, index) => {
    const needsCard = event.entityType === "service_card" || event.serviceCardId !== undefined;
    const needsService = event.entityType === "profile_service" || event.profileServiceId !== undefined;
    if (needsCard && (!event.serviceCardId || !event.profileServiceId || !event.providerProfileId || !event.specialtyId)) {
      ctx.addIssue({ code: "custom", path: ["events", index], message: "Una carta necesita perfil, servicio y especialidad." });
    } else if (needsService && (!event.profileServiceId || !event.providerProfileId || !event.specialtyId)) {
      ctx.addIssue({ code: "custom", path: ["events", index], message: "Un servicio necesita perfil y especialidad." });
    } else if (event.entityType === "provider_profile" && !event.providerProfileId) {
      ctx.addIssue({ code: "custom", path: ["events", index], message: "Un perfil necesita providerProfileId." });
    }
    if (event.eventName === "result_impression" && (!event.listViewId || !event.resultItemId || !event.impressionId)) {
      ctx.addIssue({ code: "custom", path: ["events", index], message: "Una impresión necesita lista, ocurrencia e impresión." });
    }
  });
});

export type ValidAnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type ValidAnalyticsSegment = z.infer<typeof analyticsSegmentSchema>;
