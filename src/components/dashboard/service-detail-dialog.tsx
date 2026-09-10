"use client";

import { useEffect, useId, useRef } from "react";

import { ServiceDetailContent } from "@/components/service-detail-content";
import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import type { Profile, ServiceCard } from "@/types";

/** Vista previa de la ruta pública, disponible también para cartas privadas. */
export function ServiceDetailDialog({
  card,
  profile,
  onClose,
}: {
  card: ServiceCard;
  profile: Profile;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#101828]/70 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full min-w-0 max-w-[1200px] flex-col overflow-hidden bg-white shadow-pop sm:h-auto sm:max-h-[94dvh] sm:rounded-card sm:border sm:border-white/20">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[16px] font-bold text-ink">
              Detalles de {card.title}
            </h2>
            <p className="text-[12.5px] text-ink-soft">
              Así se verá la página pública de este servicio.
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalles"
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${SECONDARY_SURFACE}`}
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface-muted overscroll-contain">
          <ServiceDetailContent card={card} profile={profile} embedded />
        </div>
      </div>
    </div>
  );
}
