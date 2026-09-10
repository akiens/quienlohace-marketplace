"use client";

import {
  ANALYTICS_CAPTURE_POLICY_VERSION,
  ANALYTICS_COLLECTOR_VERSION,
  ANALYTICS_PRIVACY_POLICY_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsEntity,
  type AnalyticsEventName,
  type AnalyticsSegment,
  type StoredAnalyticsEvent,
} from "@/domain/analytics";

const ENDPOINT = "/api/analytics/events";
const SESSION_ENDPOINT = "/api/analytics/session";
const INTERVAL_MS = 60_000;
const SESSION_IDLE_MS = 30 * 60_000;
const SESSION_MAX_MS = 24 * 60 * 60_000;
// Reserva ~1 KiB para la cabecera y separadores del segmento de 20 KiB.
const SEGMENT_MAX_BYTES = 19 * 1024;
const QUEUE_MAX_BYTES = 256 * 1024;
const QUEUE_MAX_EVENTS = 200;
const SESSION_KEY = "qlh:analytics:session:v1";
const TAB_KEY = "qlh:analytics:tab:v1";
const NAVIGATION_KEY = "qlh:analytics:navigation:v1";

type PageState = AnalyticsEntity & {
  pageViewId: string;
  previousPageViewId?: string;
  pageType: string;
  surface?: string;
  sourceInteractionId?: string;
  searchId?: string;
  searchExecutionId?: string;
  resultSetId?: string;
  listViewId?: string;
  resultItemId?: string;
};

type EventInput = AnalyticsEntity & {
  eventName: AnalyticsEventName;
  observationKind: StoredAnalyticsEvent["observationKind"];
  properties: Record<string, unknown>;
  pageViewId?: string;
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
};

type Identity = {
  sessionId: string;
  ingestionToken: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
};

let initialized = false;
let initialization: Promise<boolean> | null = null;
let enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false";
let identity: Identity | null = null;
let tabId = "";
let sequence = 0;
let segmentSequence = 0;
let currentEvents: StoredAnalyticsEvent[] = [];
let currentBytes = 0;
let segmentStartedAt = "";
let sendTimer: ReturnType<typeof setTimeout> | null = null;
let pending: AnalyticsSegment[] = [];
let pendingBytes = 0;
let sending = false;
let droppedEvents = 0;
let currentPage: PageState | null = null;
let previousPageViewId: string | undefined;
let tabChannel: BroadcastChannel | null = null;
let intervalHook: (() => void) | null = null;
let identityRotation: Promise<void> | null = null;

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readIdentity(): Identity | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as Identity | null;
    if (
      !parsed
      || typeof parsed.sessionId !== "string"
      || typeof parsed.ingestionToken !== "string"
      || typeof parsed.expiresAt !== "number"
    ) return null;
    const now = Date.now();
    if (now - parsed.lastActivityAt > SESSION_IDLE_MS || now - parsed.createdAt > SESSION_MAX_MS || parsed.expiresAt <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function requestIdentity(existing: Identity | null, rotate = false): Promise<Identity | null> {
  try {
    const response = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ existingToken: existing?.ingestionToken, rotate }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const value = await response.json() as Partial<Identity> & { issuedAt?: number };
    if (
      typeof value.sessionId !== "string"
      || typeof value.ingestionToken !== "string"
      || typeof value.issuedAt !== "number"
      || typeof value.expiresAt !== "number"
    ) return null;
    const continued = existing?.sessionId === value.sessionId;
    return {
      sessionId: value.sessionId,
      ingestionToken: value.ingestionToken,
      createdAt: continued ? existing.createdAt : value.issuedAt,
      lastActivityAt: continued ? existing.lastActivityAt : Date.now(),
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

function persistIdentity(): void {
  if (!identity) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    sessionStorage.setItem(TAB_KEY, tabId);
  } catch {
    // El almacenamiento puede estar bloqueado. La identidad en memoria alcanza.
  }
}

async function resolveDuplicatedTab(candidate: string): Promise<boolean> {
  if (!("BroadcastChannel" in window)) return false;
  const channel = new BroadcastChannel("qlh:analytics:tabs:v1");
  tabChannel = channel;
  let collision = false;
  channel.onmessage = (message: MessageEvent<{ type: string; tabId?: string }>) => {
    if (message.data.type === "probe" && message.data.tabId === tabId) channel.postMessage({ type: "claimed", tabId });
    if (message.data.type === "claimed" && message.data.tabId === candidate) collision = true;
  };
  channel.postMessage({ type: "probe", tabId: candidate });
  await new Promise((resolve) => setTimeout(resolve, 40));
  return collision;
}

export async function initializeAnalytics(): Promise<boolean> {
  if (initialization) return initialization;
  initialization = (async () => {
    if (initialized) return enabled;
    initialized = true;
    if (!enabled || typeof window === "undefined") return false;
    identity = await requestIdentity(readIdentity());
    if (!identity) return false;
    const storedTab = sessionStorage.getItem(TAB_KEY) ?? uuid("tab");
    tabId = storedTab;
    if (await resolveDuplicatedTab(storedTab)) {
      tabId = uuid("tab");
      identity = await requestIdentity(null, true);
      if (!identity) return false;
    }
    persistIdentity();
    return true;
  })();
  return initialization;
}

export function markHumanActivity(): void {
  if (!identity) return;
  const now = Date.now();
  if (now - identity.lastActivityAt < 5_000) return;
  if (now - identity.lastActivityAt > SESSION_IDLE_MS || now - identity.createdAt > SESSION_MAX_MS) {
    void rotateIdentity();
    return;
  } else {
    identity.lastActivityAt = now;
  }
  persistIdentity();
}

async function rotateIdentity(): Promise<void> {
  if (identityRotation) return identityRotation;
  identityRotation = (async () => {
    void closeSegment("session_timeout");
    identity = null;
    sequence = 0;
    segmentSequence = 0;
    previousPageViewId = undefined;
    const next = await requestIdentity(null, true);
    if (!next || !enabled) return;
    identity = next;
    persistIdentity();
    if (currentPage) {
      const page = beginPage(currentPage);
      if (page) trackAnalytics({
        eventName: "page_view",
        observationKind: "navigation",
        properties: { routeType: page.pageType, navigationSource: "restore" },
      });
    }
  })().finally(() => { identityRotation = null; });
  return identityRotation;
}

export function beginPage(input: Omit<PageState, "pageViewId" | "previousPageViewId">): PageState | null {
  if (!enabled || !identity) return null;
  const page: PageState = { ...input, pageViewId: uuid("view"), previousPageViewId };
  previousPageViewId = page.pageViewId;
  currentPage = page;
  return page;
}

export function getCurrentPage(): PageState | null {
  return currentPage;
}

function buildEvent(input: EventInput): StoredAnalyticsEvent | null {
  if (!enabled || !identity) return null;
  const page = currentPage;
  sequence += 1;
  return {
    eventId: uuid("event"),
    eventName: input.eventName,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    collectorVersion: ANALYTICS_COLLECTOR_VERSION,
    appRelease: process.env.NEXT_PUBLIC_APP_RELEASE ?? "development",
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    occurredAt: nowIso(),
    clientSequence: sequence,
    monotonicMs: performance.now(),
    source: "browser",
    observationKind: input.observationKind,
    sessionId: identity.sessionId,
    tabId,
    pageViewId: input.pageViewId ?? page?.pageViewId,
    previousPageViewId: page?.previousPageViewId,
    searchId: input.searchId ?? page?.searchId,
    previousSearchId: input.previousSearchId,
    searchExecutionId: input.searchExecutionId ?? page?.searchExecutionId,
    resultSetId: input.resultSetId ?? page?.resultSetId,
    listViewId: input.listViewId ?? page?.listViewId,
    resultItemId: input.resultItemId ?? page?.resultItemId,
    impressionId: input.impressionId,
    interactionId: input.interactionId,
    sourceInteractionId: input.sourceInteractionId ?? page?.sourceInteractionId,
    entityType: input.entityType ?? page?.entityType,
    providerProfileId: input.providerProfileId ?? page?.providerProfileId,
    profileServiceId: input.profileServiceId ?? page?.profileServiceId,
    serviceCardId: input.serviceCardId ?? page?.serviceCardId,
    specialtyId: input.specialtyId ?? page?.specialtyId,
    serviceSectorId: input.serviceSectorId ?? page?.serviceSectorId,
    entitySnapshotId: input.entitySnapshotId ?? page?.entitySnapshotId,
    pageType: input.pageType ?? page?.pageType,
    surface: input.surface ?? page?.surface,
    componentId: input.componentId,
    placement: input.placement,
    uiVersion: "web-1",
    privacyPolicyVersion: ANALYTICS_PRIVACY_POLICY_VERSION,
    capturePolicyVersion: ANALYTICS_CAPTURE_POLICY_VERSION,
    sampleRate: 1,
    properties: input.properties,
  };
}

export function trackAnalytics(input: EventInput): string | null {
  const event = buildEvent(input);
  if (!event) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
  if (bytes > SEGMENT_MAX_BYTES) {
    droppedEvents += 1;
    return null;
  }
  if (currentEvents.length && (currentBytes + bytes > SEGMENT_MAX_BYTES || currentEvents.length >= 50)) void closeSegment("size_limit");
  if (!currentEvents.length) {
    segmentStartedAt = nowIso();
    armInterval();
  }
  currentEvents.push(event);
  currentBytes += bytes;
  return event.eventId;
}

export async function closeSegment(reason: AnalyticsSegment["closeReason"], preferBeacon = false): Promise<void> {
  if (!identity || !currentEvents.length) return;
  if (sendTimer) clearTimeout(sendTimer);
  sendTimer = null;
  tabChannel?.close();
  tabChannel = null;
  const segment: AnalyticsSegment = {
    segmentId: uuid("segment"), ingestionToken: identity.ingestionToken,
    sessionId: identity.sessionId, tabId, segmentSequence: ++segmentSequence,
    startedAt: segmentStartedAt, endedAt: nowIso(), lastActivityAt: new Date(identity.lastActivityAt).toISOString(),
    closeReason: reason, schemaVersion: ANALYTICS_SCHEMA_VERSION, events: currentEvents, droppedEvents,
  };
  currentEvents = [];
  currentBytes = 0;
  droppedEvents = 0;
  const encoded = JSON.stringify(segment);
  const bytes = new TextEncoder().encode(encoded).byteLength;
  while (pending.length && (pendingBytes + bytes > QUEUE_MAX_BYTES || pending.reduce((sum, item) => sum + item.events.length, 0) + segment.events.length > QUEUE_MAX_EVENTS)) {
    const removed = pending.shift();
    if (removed) pendingBytes -= new TextEncoder().encode(JSON.stringify(removed)).byteLength;
  }
  pending.push(segment);
  pendingBytes += bytes;
  if (reason === "interval") armInterval();
  if (preferBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([encoded], { type: "application/json" }))) return;
  await drainQueue(preferBeacon);
}

async function drainQueue(keepalive = false): Promise<void> {
  if (sending || !pending.length || !enabled) return;
  sending = true;
  try {
    while (pending.length) {
      const segment = pending[0];
      const payload = JSON.stringify(segment);
      let delivered = false;
      for (let attempt = 0; attempt < 3 && !delivered; attempt += 1) {
        try {
          const response = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive });
          if (response.ok) delivered = true;
          else if (response.status < 500 && response.status !== 429) return;
        } catch {
          // La observación no debe afectar la navegación. Se reintenta acotado.
        }
        if (!delivered) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 150));
      }
      if (!delivered) return;
      pending.shift();
      pendingBytes -= new TextEncoder().encode(payload).byteLength;
    }
  } finally {
    sending = false;
  }
}

export function disableAnalytics(): void {
  enabled = false;
  currentEvents = [];
  pending = [];
  currentBytes = 0;
  pendingBytes = 0;
  if (sendTimer) clearTimeout(sendTimer);
  sendTimer = null;
  tabChannel?.close();
  tabChannel = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TAB_KEY);
  } catch {}
}

function armInterval(): void {
  if (sendTimer || !enabled || typeof document === "undefined" || document.visibilityState === "hidden") return;
  sendTimer = setTimeout(() => {
    sendTimer = null;
    intervalHook?.();
    void closeSegment("interval");
  }, INTERVAL_MS);
}

export function setAnalyticsIntervalHook(hook: (() => void) | null): void {
  intervalHook = hook;
}

export function analyticsId(prefix: string): string {
  return uuid(prefix);
}

export function flushAnalytics(): void {
  void drainQueue(false);
}

export function rememberAnalyticsNavigation(
  href: string,
  context: Pick<PageState, "sourceInteractionId" | "searchId" | "searchExecutionId" | "resultSetId" | "listViewId" | "resultItemId" | "entitySnapshotId">,
): void {
  try {
    const destination = new URL(href, location.href);
    if (destination.origin !== location.origin) return;
    sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify({ ...context, pathname: destination.pathname, createdAt: Date.now() }));
  } catch {}
}

export function consumeAnalyticsNavigation(pathname: string): Partial<PageState> {
  try {
    const raw = sessionStorage.getItem(NAVIGATION_KEY);
    sessionStorage.removeItem(NAVIGATION_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as Partial<PageState> & { pathname?: string; createdAt?: number };
    if (value.pathname !== pathname || typeof value.createdAt !== "number" || Date.now() - value.createdAt > 30_000) return {};
    return {
      sourceInteractionId: value.sourceInteractionId,
      searchId: value.searchId,
      searchExecutionId: value.searchExecutionId,
      resultSetId: value.resultSetId,
      listViewId: value.listViewId,
      resultItemId: value.resultItemId,
      entitySnapshotId: value.entitySnapshotId,
    };
  } catch {
    return {};
  }
}
