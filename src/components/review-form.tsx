"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { deleteReview, submitReview } from "@/app/actions/reviews";
import type { FormState } from "@/app/actions/auth";
import { GoogleMark } from "@/components/google-mark";
import { Button, Icon, SECONDARY_SURFACE } from "@/components/ui";
import { reviewSchema } from "@/lib/validation";
import { FIELD_ERROR_DELAY_MS } from "@/lib/use-field-errors";
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
  profileId,
  providerSlug,
}: {
  profileId: string;
  providerSlug: string;
}) {
  // El perfil se sirve desde caché, así que la identidad no puede venir en el
  // HTML: se pide aparte, igual que el estado de sesión del header.
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [open, setOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  /*
   * El comentario es controlado y se valida contra `reviewSchema` (TR-039),
   * el mismo que usa la acción. Antes era un campo suelto con `minLength`
   * nativo: el navegador lo rechazaba en su idioma y con su propio mensaje,
   * distinto del que devolvía el servidor para la misma regla.
   */
  const [comment, setComment] = useState("");
  const [commentTouched, setCommentTouched] = useState(false);

  /*
   * La pausa tras la que se muestra el error escribiendo (TR-039). Cada tecla
   * la reinicia: de corrido no marca en rojo un comentario a medio escribir, y
   * al detenerse con algo inválido avisa sin salir del campo.
   */
  const revealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(revealTimer.current), []);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const authStatus = currentUrl.searchParams.get("auth");
    const authErrorMessage = authStatus
      ? authStatus === "suspended"
        ? "Esta cuenta no está habilitada para publicar opiniones."
        : "No pudimos completar el ingreso con Google. Intentá nuevamente."
      : "";
    if (authStatus) {
      currentUrl.searchParams.delete("auth");
      window.history.replaceState(null, "", currentUrl);
    }

    fetch(`/api/review-context?profileId=${encodeURIComponent(profileId)}`)
      .then((response) =>
        response.ok ? (response.json() as Promise<ReviewContext>) : null,
      )
      .then((data) => {
        if (!active) return;
        if (authErrorMessage) setAuthError(authErrorMessage);
        if (!data) return;
        setContext(data);
        setRating(data.existing?.rating ?? 0);
        setComment(data.existing?.comment ?? "");
        // Al volver de Google se reabre el formulario donde se había quedado.
        if (data.consumer && window.location.search.includes("opinar=1")) {
          setOpen(true);
        }
      })
      .catch(() => {
        if (active && authErrorMessage) setAuthError(authErrorMessage);
        // Que falle esta consulta no debe romper la lectura de opiniones.
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReview,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<
    FormState,
    FormData
  >(deleteReview, {});

  const message = state.message ?? deleteState.message;
  const errors = state.errors ?? {};

  /** El comentario contra su regla del schema. */
  const commentCheck = reviewSchema.shape.comment.safeParse(comment);
  const commentError = commentCheck.success
    ? ""
    : (commentCheck.error.issues[0]?.message ?? "");

  /*
   * El error se muestra al salir del campo o cuando el servidor lo devolvió,
   * no mientras se escribe: tipeando el comentario está corto casi todo el
   * tiempo y marcarlo en rojo desde la primera letra no ayuda (TR-039).
   */
  const shownCommentError = errors.comment ?? (commentTouched ? commentError : "");

  const canSubmit = rating > 0 && commentError === "";
  const consumer = context?.consumer ?? null;
  const existing = context?.existing ?? null;
  const googleEnabled = context?.googleEnabled ?? false;

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
        {authError ? (
          <p
            role="alert"
            className="w-full text-[13px] font-medium text-[#B42318]"
          >
            {authError}
          </p>
        ) : null}
        <p className="flex-1 text-[13.5px] text-ink-soft">
          ¿Trabajaste con este profesional? Contá tu experiencia.
        </p>
        {googleEnabled ? (
          <a
            href={`/auth/google?returnTo=${encodeURIComponent(`/profesionales/${providerSlug}`)}`}
            className={`inline-flex items-center justify-center gap-2 rounded-input px-4 py-2 text-[13.5px] font-semibold ${SECONDARY_SURFACE}`}
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
      /*
       * `noValidate`: los mensajes nativos del navegador están en otro idioma
       * y contradicen a los del schema, que son los que se muestran acá.
       */
      noValidate
      className="flex flex-col gap-4 rounded-input border border-line bg-white p-4"
    >
      <input type="hidden" name="profileId" value={profileId} />
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
          value={comment}
          onChange={(event) => {
            const value = event.target.value;
            setComment(value);

            clearTimeout(revealTimer.current);
            // Válido: el rojo se va en el acto. Inválido: aparece tras la pausa.
            if (reviewSchema.shape.comment.safeParse(value).success) {
              setCommentTouched(false);
            } else {
              revealTimer.current = setTimeout(
                () => setCommentTouched(true),
                FIELD_ERROR_DELAY_MS,
              );
            }
          }}
          onBlur={() => {
            clearTimeout(revealTimer.current);
            setCommentTouched(true);
          }}
          aria-invalid={shownCommentError ? true : undefined}
          aria-describedby={shownCommentError ? "review-comment-error" : undefined}
          placeholder="¿Cómo fue tu experiencia? Contá qué trabajo hizo y cómo te atendió."
          className={`w-full resize-y rounded-input border px-3.5 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-800 ${
            shownCommentError ? "border-[#FDA29B]" : "border-line-strong"
          }`}
        />
        {shownCommentError ? (
          <FieldError id="review-comment-error">{shownCommentError}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/*
          El botón se enciende sólo con la opinión entera válida (TR-039): con
          sólo la puntuación puesta, apretarlo devolvía un error del servidor
          por algo que ya se sabía acá.
        */}
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
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
function FieldError({
  children,
  id,
}: {
  children: React.ReactNode;
  /** Para que el campo lo apunte con `aria-describedby`. */
  id?: string;
}) {
  return (
    <span
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]"
    >
      <Icon name="error" className="text-[15px]" />
      {children}
    </span>
  );
}
