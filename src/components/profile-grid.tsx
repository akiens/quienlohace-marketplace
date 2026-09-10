"use client";

import { useEffect, useId, useState } from "react";

import { TrackedResult } from "@/components/analytics/tracked-result";
import { ProfileCard, ProfileCardSkeleton } from "@/components/profile-card";
import { AdSlot, Button, EmptyState, PROVIDER_GRID } from "@/components/ui";
import { PAGE_SIZE, type Profile } from "@/types";
import { initializeAnalytics, trackAnalytics } from "@/lib/analytics/client";

/**
 * Listado paginado. Se muestran 12 resultados y el resto se pide en tandas con
 * un botón explícito: sin scroll infinito, para que el pie de página siga
 * siendo alcanzable.
 */
export function ProfileGrid(props: {
  profiles: Profile[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
  showAd?: boolean;
  matches?: Record<string, string>;
  initialVisible?: number;
}) {
  // La lista de IDs identifica al conjunto de resultados: si cambia, React
  // remonta el componente y la paginación vuelve sola a la primera tanda,
  // sin necesidad de un efecto que reinicie el estado.
  const resetKey = [
    props.initialVisible ?? PAGE_SIZE,
    ...props.profiles.map((profile) => `${profile.id}:${props.matches?.[profile.id] ?? ""}`),
  ].join("|");
  return <Grid key={resetKey} {...props} />;
}

function Grid({
  profiles,
  loading = false,
  emptyTitle = "No encontramos profesionales con esos filtros",
  emptyBody,
  showAd = false,
  matches,
  initialVisible = PAGE_SIZE,
}: {
  profiles: Profile[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
  showAd?: boolean;
  matches?: Record<string, string>;
  initialVisible?: number;
}) {
  const [visible, setVisible] = useState(initialVisible);
  const listViewId = `list_${useId().replaceAll(":", "_")}`;
  const shown = profiles.slice(0, visible);
  const remaining = profiles.length - shown.length;

  useEffect(() => {
    if (loading || shown.length === 0) return;
    void initializeAnalytics().then((ready) => {
      if (ready) trackAnalytics({ eventName: "list_viewed", observationKind: "client_observation", listViewId, surface: "profile_grid", properties: { itemCount: shown.length, listType: "profile_grid" } });
    });
  }, [listViewId, loading, shown.length]);

  if (loading) {
    return (
      <div className={PROVIDER_GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <ProfileCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        {emptyBody ?? (
          <>
            Probá quitar algún filtro, ampliar la zona o buscar con otras
            palabras. También podés recorrer las categorías desde el menú.
          </>
        )}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={PROVIDER_GRID}>
        {shown.map((profile, index) => (
          <TrackedResult
            key={profile.id}
            resultKind="profile"
            position={index + 1}
            listViewId={listViewId}
            resultItemId={`${listViewId}:item:${index + 1}`}
            entityType="provider_profile"
            providerProfileId={profile.id}
            specialtyId={profile.specialtyIds[0]}
            surface="profile_grid"
          >
            <ProfileCard profile={profile} match={matches?.[profile.id]} />
          </TrackedResult>
        ))}
      </div>

      {/* La publicidad aparece después de mostrar valor, nunca antes. */}
      {showAd && shown.length >= PAGE_SIZE ? <AdSlot /> : null}

      {remaining > 0 ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            Mostrar {Math.min(PAGE_SIZE, remaining)} más
            <span className="text-ink-soft">({remaining} restantes)</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
