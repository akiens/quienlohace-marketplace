"use client";

import { useState } from "react";

import { Button, Icon, Stars } from "@/components/ui";
import type { Review } from "@/types";

const VISIBLE_REVIEWS = 5;

/** Formatea una fecha ISO sin depender del huso del navegador. */
function formatDate(iso: string): string {
  const [year, month] = iso.split("-");
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const index = Number(month) - 1;
  return `${months[index] ?? ""} ${year}`;
}

/**
 * Leer opiniones no requiere cuenta. Publicar sí: la autenticación aparece
 * recién cuando el usuario quiere participar.
 */
export function ReviewList({
  reviews,
  totalCount,
}: {
  reviews: Review[];
  totalCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          {totalCount > 0
            ? "Las opiniones de este profesional todavía no están disponibles."
            : "Este profesional todavía no tiene opiniones. Si trabajaste con él, tu reseña ayuda a los demás."}
        </p>
        <ReviewCta />
      </div>
    );
  }

  const shown = expanded ? reviews : reviews.slice(0, VISIBLE_REVIEWS);
  const hidden = reviews.length - shown.length;

  return (
    <div className="flex flex-col gap-4">
      {shown.map((review) => (
        <article
          key={review.id}
          className="flex flex-col gap-2 border-b border-line-soft pb-4 last:border-b-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[14.5px] font-semibold text-ink">
              {review.authorName}
            </span>
            <Stars rating={review.rating} />
            <span className="text-[13px] text-ink-faint">
              {formatDate(review.createdAt)}
            </span>
          </div>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">
            {review.comment}
          </p>
        </article>
      ))}

      {hidden > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setExpanded(true)}
        >
          Ver {hidden} {hidden === 1 ? "opinión más" : "opiniones más"}
        </Button>
      ) : null}

      <ReviewCta />
    </div>
  );
}

function ReviewCta() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-input bg-surface-muted p-3.5">
      <p className="flex-1 text-[13.5px] text-ink-soft">
        ¿Trabajaste con este profesional? Contá tu experiencia.
      </p>
      <Button variant="secondary" size="sm">
        <Icon name="rate_review" className="text-[17px] text-brand-800" />
        Dejar una opinión
      </Button>
    </div>
  );
}
