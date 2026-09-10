"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

import type { AnalyticsEntity } from "@/domain/analytics";
import { analyticsId, trackAnalytics } from "@/lib/analytics/client";

type Props = AnalyticsEntity & AnchorHTMLAttributes<HTMLAnchorElement> & {
  channel: "whatsapp" | "phone" | "email" | "website" | "social";
  children: ReactNode;
  surface?: string;
};

export function TrackedContactLink({
  channel, children, providerProfileId, profileServiceId, serviceCardId, entityType, surface,
  specialtyId, serviceSectorId, entitySnapshotId, ...anchor
}: Props) {
  return (
    <a
      {...anchor}
      onClick={(event) => {
        anchor.onClick?.(event);
        trackAnalytics({
          eventName: "contact_clicked", observationKind: "interaction", interactionId: analyticsId("interaction"),
          entityType, providerProfileId, profileServiceId, serviceCardId, specialtyId, serviceSectorId, entitySnapshotId, surface,
          properties: { channel, action: "open_contact_link" },
        });
      }}
    >
      {children}
    </a>
  );
}
