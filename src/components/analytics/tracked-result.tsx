"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { AnalyticsEntity } from "@/domain/analytics";
import { analyticsId, rememberAnalyticsNavigation, trackAnalytics } from "@/lib/analytics/client";

type Observed = { timer: ReturnType<typeof setTimeout> | null; onImpression: () => void };
const observed = new Map<Element, Observed>();
let sharedObserver: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  sharedObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const target = observed.get(entry.target);
      if (!target) continue;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        target.timer ??= setTimeout(() => {
          target.onImpression();
          sharedObserver?.unobserve(entry.target);
          observed.delete(entry.target);
        }, 1000);
      } else if (target.timer) {
        clearTimeout(target.timer);
        target.timer = null;
      }
    }
  }, { threshold: [0.5] });
  return sharedObserver;
}

function observeImpression(element: Element, onImpression: () => void): () => void {
  observed.set(element, { timer: null, onImpression });
  observer().observe(element);
  return () => {
    const target = observed.get(element);
    if (target?.timer) clearTimeout(target.timer);
    observed.delete(element);
    sharedObserver?.unobserve(element);
    if (observed.size === 0) { sharedObserver?.disconnect(); sharedObserver = null; }
  };
}

type Props = AnalyticsEntity & {
  children: ReactNode;
  resultKind: "profile" | "service";
  position: number;
  listViewId: string;
  resultSetId?: string;
  resultItemId: string;
  searchId?: string;
  searchExecutionId?: string;
  surface: string;
  className?: string;
};

export function TrackedResult({ children, resultKind, position, className, ...context }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const impressionId = useRef<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || impressionId.current || !("IntersectionObserver" in window)) return;
    return observeImpression(element, () => {
      impressionId.current = analyticsId("impression");
      trackAnalytics({
        ...context, impressionId: impressionId.current, eventName: "result_impression", observationKind: "impression",
        properties: { position, pagePosition: position, page: 1, thresholdMs: 1000, visibleRatio: 0.5, resultKind },
      });
    });
  }, [context, position, resultKind]);

  return (
    <div
      ref={ref}
      className={className}
      onClickCapture={(event) => {
        const anchor = (event.target as Element).closest("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href") ?? "";
        const channel = href.startsWith("https://wa.me/") ? "whatsapp" : href.startsWith("tel:") ? "phone" : href.startsWith("mailto:") ? "email" : null;
        const interactionId = analyticsId("interaction");
        if (channel) {
          trackAnalytics({ ...context, interactionId, eventName: "contact_clicked", observationKind: "interaction", properties: { channel, action: "open_contact_link" } });
        } else {
          if (!(event.metaKey || event.ctrlKey || event.shiftKey) && anchor.target !== "_blank") {
            rememberAnalyticsNavigation(href, {
              sourceInteractionId: interactionId,
              searchId: context.searchId,
              searchExecutionId: context.searchExecutionId,
              resultSetId: context.resultSetId,
              listViewId: context.listViewId,
              resultItemId: context.resultItemId,
              entitySnapshotId: context.entitySnapshotId,
            });
          }
          trackAnalytics({
            ...context, interactionId, impressionId: impressionId.current ?? undefined, eventName: "result_clicked", observationKind: "interaction",
            properties: { position, action: resultKind === "profile" ? "open_profile" : "open_service", resultKind, hadImpression: impressionId.current !== null },
          });
        }
      }}
    >
      {children}
    </div>
  );
}
