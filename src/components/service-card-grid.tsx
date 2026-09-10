"use client";

import { useEffect, useId, useState } from "react";

import { TrackedResult } from "@/components/analytics/tracked-result";
import { ServiceOfferCard } from "@/components/service-offer-card";
import { Button, EmptyState, PROVIDER_GRID } from "@/components/ui";
import { PAGE_SIZE, type ServiceCard } from "@/types";
import { initializeAnalytics, trackAnalytics } from "@/lib/analytics/client";

export function ServiceCardGrid({
  cards,
  matches,
  initialVisible = PAGE_SIZE,
}: {
  cards: ServiceCard[];
  matches?: Record<string, string>;
  initialVisible?: number;
}) {
  const [visible, setVisible] = useState(initialVisible);
  const listViewId = `list_${useId().replaceAll(":", "_")}`;
  const shown = cards.slice(0, visible);
  const remaining = cards.length - shown.length;
  useEffect(() => {
    if (shown.length === 0) return;
    void initializeAnalytics().then((ready) => {
      if (ready) trackAnalytics({ eventName: "list_viewed", observationKind: "client_observation", listViewId, surface: "service_card_grid", properties: { itemCount: shown.length, listType: "service_card_grid" } });
    });
  }, [listViewId, shown.length]);
  if (cards.length === 0) {
    return (
      <EmptyState icon="sell" title="No encontramos cartas de servicio con esos filtros">
        Probá ampliar la zona, quitar algún filtro o buscar con otras palabras.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className={PROVIDER_GRID}>
        {shown.map((card, index) => (
          <TrackedResult
            key={card.id}
            resultKind="service"
            position={index + 1}
            listViewId={listViewId}
            resultItemId={`${listViewId}:item:${index + 1}`}
            entityType="service_card"
            providerProfileId={card.profileId}
            profileServiceId={card.serviceId}
            serviceCardId={card.id}
            specialtyId={card.specialtyId}
            surface="service_card_grid"
          >
            <ServiceOfferCard card={card} match={matches?.[card.id]} />
          </TrackedResult>
        ))}
      </div>
      {remaining > 0 ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((value) => value + PAGE_SIZE)}>
            Mostrar {Math.min(PAGE_SIZE, remaining)} más
          </Button>
        </div>
      ) : null}
    </div>
  );
}
