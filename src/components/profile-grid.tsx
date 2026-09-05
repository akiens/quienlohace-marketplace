"use client";

import { useState } from "react";

import { ProfileCard, ProfileCardSkeleton } from "@/components/profile-card";
import { AdSlot, Button, EmptyState, PROVIDER_GRID } from "@/components/ui";
import { PAGE_SIZE, type Profile } from "@/types";

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
}) {
  // La lista de IDs identifica al conjunto de resultados: si cambia, React
  // remonta el componente y la paginación vuelve sola a la primera tanda,
  // sin necesidad de un efecto que reinicie el estado.
  const resetKey = props.profiles.map((profile) => profile.id).join("|");
  return <Grid key={resetKey} {...props} />;
}

function Grid({
  profiles,
  loading = false,
  emptyTitle = "No encontramos profesionales con esos filtros",
  emptyBody,
  showAd = false,
}: {
  profiles: Profile[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
  showAd?: boolean;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

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

  const shown = profiles.slice(0, visible);
  const remaining = profiles.length - shown.length;

  return (
    <div className="flex flex-col gap-6">
      <div className={PROVIDER_GRID}>
        {shown.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} />
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
