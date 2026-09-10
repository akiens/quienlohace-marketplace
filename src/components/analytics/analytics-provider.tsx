"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  beginPage,
  closeSegment,
  consumeAnalyticsNavigation,
  disableAnalytics,
  flushAnalytics,
  initializeAnalytics,
  markHumanActivity,
  setAnalyticsIntervalHook,
  trackAnalytics,
} from "@/lib/analytics/client";

const PRIVATE_PREFIXES = ["/dashboard", "/api", "/auth", "/registro", "/entrar"];

function routeType(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/buscar") return "search_results";
  const staticRoutes: Record<string, string> = {
    "/como-funciona": "how_it_works",
    "/contacto": "contact",
    "/destacados": "featured",
    "/faq": "faq",
    "/planes": "plans",
    "/privacidad": "privacy",
    "/sobre-nosotros": "about",
  };
  if (staticRoutes[pathname]) return staticRoutes[pathname];
  if (/^\/profesionales\/[^/]+\/servicios\//.test(pathname)) return "service_detail";
  if (/^\/profesionales\//.test(pathname)) return "provider_profile";
  if (/^\/categorias\//.test(pathname)) return "category";
  return "public_content";
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const collectionDisabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "false";
  const activity = useRef({ started: 0, last: 0, active: 0, visible: 0, sequence: 0 });

  useEffect(() => {
    if (collectionDisabled) disableAnalytics();
  }, [collectionDisabled]);

  useEffect(() => {
    if (isPrivate || collectionDisabled) return;
    setAnalyticsIntervalHook(() => emitActivity(activity.current));
    let cancelled = false;
    const timer = setTimeout(() => {
      void initializeAnalytics().then((ready) => {
        if (!ready || cancelled || document.visibilityState !== "visible") return;
        const marker = document.querySelector<HTMLElement>("[data-analytics-page-context]");
        if (marker?.dataset.analyticsDisabled === "true") return;
        const attribution = consumeAnalyticsNavigation(pathname);
        const page = beginPage({
          ...attribution,
          pageType: marker?.dataset.pageType ?? routeType(pathname),
          surface: marker?.dataset.surface,
          entityType: marker?.dataset.entityType as "provider_profile" | "profile_service" | "service_card" | undefined,
          providerProfileId: marker?.dataset.providerProfileId,
          profileServiceId: marker?.dataset.profileServiceId,
          serviceCardId: marker?.dataset.serviceCardId,
          specialtyId: marker?.dataset.specialtyId,
          serviceSectorId: marker?.dataset.serviceSectorId,
          entitySnapshotId: marker?.dataset.entitySnapshotId ?? attribution.entitySnapshotId,
        });
        if (page) trackAnalytics({ eventName: "page_view", observationKind: "navigation", properties: { routeType: routeType(pathname), navigationSource: page.sourceInteractionId ? "internal" : "unknown" } });
        activity.current = { started: performance.now(), last: performance.now(), active: 0, visible: 0, sequence: 0 };
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      emitActivity(activity.current);
    };
  }, [collectionDisabled, isPrivate, pathname, searchParams]);

  useEffect(() => {
    if (isPrivate || collectionDisabled) return;
    let scrollFrame = 0;
    const reached = new Set<number>();
    const touch = () => {
      const now = performance.now();
      measureActivity(activity.current, now);
      markHumanActivity();
      activity.current.last = now;
    };
    const onScroll = () => {
      touch();
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const root = document.documentElement;
        const available = Math.max(1, root.scrollHeight - innerHeight);
        const percent = ((scrollY + innerHeight) / Math.max(root.scrollHeight, innerHeight)) * 100;
        for (const milestone of [25, 50, 75, 90] as const) {
          if (percent >= milestone && !reached.has(milestone)) {
            reached.add(milestone);
            const range = available < 800 ? "short" : available < 2000 ? "medium" : available < 5000 ? "long" : "very_long";
            trackAnalytics({ eventName: "scroll_milestone", observationKind: "activity", properties: { percent: milestone, contentHeightRange: range } });
          }
        }
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") measureActivity(activity.current, performance.now());
      trackAnalytics({ eventName: "visibility_changed", observationKind: "client_observation", properties: { state: document.visibilityState === "hidden" ? "hidden" : "visible", reason: "visibilitychange" } });
      if (document.visibilityState === "hidden") { emitActivity(activity.current); void closeSegment("hidden", true); }
      else { activity.current.started = performance.now(); flushAnalytics(); }
    };
    const onPageHide = () => { emitActivity(activity.current); void closeSegment("pagehide", true); };
    addEventListener("pointerdown", touch, { passive: true });
    addEventListener("keydown", touch);
    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("pagehide", onPageHide);
    return () => {
      removeEventListener("pointerdown", touch); removeEventListener("keydown", touch); removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility); removeEventListener("pagehide", onPageHide);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      setAnalyticsIntervalHook(null);
    };
  }, [collectionDisabled, isPrivate]);

  return null;
}

function emitActivity(state: { started: number; last: number; active: number; visible: number; sequence: number }) {
  if (state.started === 0) return;
  if (document.visibilityState === "visible") measureActivity(state, performance.now());
  if (state.visible < 1) return;
  state.sequence += 1;
  trackAnalytics({ eventName: "page_activity", observationKind: "activity", properties: { visibleMs: Math.round(state.visible), activeMs: Math.round(state.active), activitySequence: state.sequence } });
  state.visible = 0; state.active = 0;
}

function measureActivity(state: { started: number; last: number; active: number; visible: number }, now: number) {
  const elapsed = Math.max(0, now - state.started);
  state.visible += elapsed;
  state.active += Math.max(0, Math.min(now, state.last + 60_000) - state.started);
  state.started = now;
}
