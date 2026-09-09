"use client";

import { useState } from "react";

import { ServiceOfferCard } from "@/components/service-offer-card";
import { Button, EmptyState, PROVIDER_GRID } from "@/components/ui";
import { PAGE_SIZE, type ServiceCard } from "@/types";

export function ServiceCardGrid({ cards }: { cards: ServiceCard[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  if (cards.length === 0) {
    return (
      <EmptyState icon="sell" title="No encontramos cartas de servicio con esos filtros">
        Probá ampliar la zona, quitar algún filtro o buscar con otras palabras.
      </EmptyState>
    );
  }
  const shown = cards.slice(0, visible);
  const remaining = cards.length - shown.length;
  return (
    <div className="flex flex-col gap-6">
      <div className={PROVIDER_GRID}>
        {shown.map((card) => <ServiceOfferCard key={card.id} card={card} />)}
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
