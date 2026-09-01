"use client";

import { useActionState, useEffect, useState } from "react";

import { deleteReview, submitReview } from "@/app/actions/reviews";
import type { FormState } from "@/app/actions/auth";
import { Button, Icon } from "@/components/ui";
import type { ConsumerUser, Review } from "@/types";

/**
 * Formulario de opinión (RF-126, RF-146, RF-151).
 *
 * Aparece sólo cuando la persona pidió opinar: nunca se muestra una pantalla
 * de login preventiva (RF-128). Si ya opinó, el formulario abre con sus
 * valores y guardar actualiza en vez de duplicar (RF-150).
 */
type ReviewContext = {
  consumer: ConsumerUser | null;
  existing: Review | null;
  googleEnabled: boolean;
};

export function ReviewForm({
  providerId,
  providerSlug,
}: {
  providerId: string;
  providerSlug: string;
}) {
  // El perfil se sirve desde caché, así que la identidad no puede venir en el
  // HTML: se pide aparte, igual que el estado de sesión del header.
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/review-context?providerId=${encodeURIComponent(providerId)}`)
      .then((response) =>
        response.ok ? (response.json() as Promise<ReviewContext>) : null,
      )
      .then((data) => {
        if (!active || !data) return;
        setContext(data);
        setRating(data.existing?.rating ?? 0);
        // Al volver de Google se reabre el formulario donde se había quedado.
        if (data.consumer && window.location.search.includes("opinar=1")) {
          setOpen(true);
        }
      })
      .catch(() => {
        // Que falle esta consulta no debe romper la lectura de opiniones.
      });
    return () => {
      active = false;
    };
  }, [providerId]);

  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReview,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<
    FormState,
    FormData
  >(deleteReview, {});

  const message = state.message ?? deleteState.message;
  const consumer = context?.consumer ?? null;
  const existing = context?.existing ?? null;
  const googleEnabled = context?.googleEnabled ?? false;
  const errors = state.errors ?? {};

  if (message) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-input border border-[#D6EFE0] bg-[#F4FBF7] p-3.5 text-[13.5px] font-medium text-[#1E8C56]"
      >
        <Icon name="check_circle" filled className="text-[17px]" />
        {message}
      </p>
    );
  }

  // Sin sesión: el login se ofrece recién al pedir opinar (RF-128).
  if (!consumer) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-input bg-surface-muted p-3.5">
        <p className="flex-1 text-[13.5px] text-ink-soft">
          ¿Trabajaste con este profesional? Contá tu experiencia.
        </p>
        {googleEnabled ? (
          <a
            href={`/auth/google?returnTo=${encodeURIComponent(`/profesionales/${providerSlug}`)}`}
            className="inline-flex items-center justify-center gap-2 rounded-input border border-line-strong bg-white px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-[#C6CEDC] hover:bg-surface-muted"
          >
            <GoogleMark />
            Continuar con Google
          </a>
        ) : (
          <p className="text-[13px] text-ink-faint">
            Las opiniones estarán disponibles muy pronto.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-input bg-surface-muted p-3.5">
        <p className="flex-1 text-[13.5px] text-ink-soft">
          {existing
            ? "Ya dejaste tu opinión sobre este profesional."
            : `Hola ${consumer.displayName.split(" ")[0]}, contá cómo te fue.`}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Icon name="rate_review" className="text-[17px] text-brand-800" />
          {existing ? "Editar mi opinión" : "Dejar una opinión"}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-input border border-line bg-white p-4"
    >
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="slug" value={providerSlug} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-ink">
          {existing ? "Editar tu opinión" : "Tu opinión"}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
          <Icon name="account_circle" className="text-[15px]" />
          {consumer.displayName}
        </span>
      </div>

      {errors.form ? <FieldError>{errors.form}</FieldError> : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-medium text-ink-muted">
          Puntuación
        </span>
        {/* Botones reales: se pueden recorrer con teclado, a diferencia de
            un puñado de iconos con onClick. */}
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHovered(value)}
              aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={rating === value}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <Icon
                name="star"
                filled={value <= (hovered || rating)}
                className={`text-[26px] ${
                  value <= (hovered || rating)
                    ? "text-[#F5A524]"
                    : "text-[#D3DAE6]"
                }`}
              />
            </button>
          ))}
        </div>
        {errors.rating ? <FieldError>{errors.rating}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="review-comment"
          className="text-[13.5px] font-medium text-ink-muted"
        >
          Comentario
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={4}
          required
          minLength={10}
          maxLength={1000}
          defaultValue={existing?.comment ?? ""}
          placeholder="¿Cómo fue tu experiencia? Contá qué trabajo hizo y cómo te atendió."
          className={`w-full resize-y rounded-input border px-3.5 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-800 ${
            errors.comment ? "border-[#FDA29B]" : "border-line-strong"
          }`}
        />
        {errors.comment ? <FieldError>{errors.comment}</FieldError> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" size="sm" disabled={pending || rating === 0}>
          {pending ? "Publicando…" : existing ? "Guardar cambios" : "Publicar"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>

        {existing ? (
          // `formAction` manda este submit a la acción de borrado sin anidar
          // otro <form>, que no es válido en HTML.
          <button
            type="submit"
            formAction={deleteAction}
            formNoValidate
            disabled={deleting}
            className="ml-auto text-[13px] font-medium text-[#B42318] hover:underline disabled:opacity-60"
          >
            {deleting ? "Borrando…" : "Borrar mi opinión"}
          </button>
        ) : null}
      </div>

      {existing ? (
        <input type="hidden" name="reviewId" value={existing.id} />
      ) : null}

      <p className="text-[12px] leading-relaxed text-ink-faint">
        Se publicará con tu nombre de Google. Tu correo no se muestra.
      </p>
    </form>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]">
      <Icon name="error" className="text-[15px]" />
      {children}
    </span>
  );
}

/** Marca de Google en SVG: evita cargar una imagen externa por un icono. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
