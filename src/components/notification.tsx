"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button, ButtonLink, Icon } from "@/components/ui";

/**
 * Aviso breve que necesita una respuesta antes de seguir.
 *
 * Usa un `dialog` nativo para que el resto de la página quede inerte, el foco
 * no salga del aviso y Escape tenga el comportamiento esperado. La segunda
 * acción es opcional para que el componente también sirva fuera de los cupos
 * de planes.
 */
export function Notification({
  title,
  children,
  acceptLabel = "Aceptar",
  actionLabel,
  actionHref,
  onAccept,
}: {
  title: string;
  children: ReactNode;
  acceptLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  onAccept: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const onAcceptRef = useRef(onAccept);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onAcceptRef.current = onAccept;
  }, [onAccept]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    acceptRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onAcceptRef.current();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-white p-0 text-ink shadow-panel backdrop:bg-ink/55"
    >
      <div className="flex flex-col items-center px-5 py-6 text-center sm:px-7 sm:py-7">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
          <Icon name="warning" className="text-2xl" />
        </span>
        <h2 id={titleId} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div
          id={descriptionId}
          className="mt-2 text-sm leading-relaxed text-ink-soft"
        >
          {children}
        </div>
        <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            ref={acceptRef}
            type="button"
            variant="secondary"
            onClick={onAccept}
            className="w-full sm:w-auto"
          >
            {acceptLabel}
          </Button>
          {actionLabel && actionHref ? (
            <ButtonLink
              href={actionHref}
              onClick={onAccept}
              className="w-full sm:w-auto"
            >
              {actionLabel}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
