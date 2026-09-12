"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/ui";

/** Native modality keeps keyboard focus inside and makes the page inert. */
export function WizardDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const marker = `wizard-${titleId}`;
    // Defer the history entry so Strict Mode's setup/cleanup probe cannot
    // leave an asynchronous history.back() closing the real dialog.
    const historyTimer = window.setTimeout(() => {
      window.history.pushState(
        { ...window.history.state, wizardDialog: marker },
        "",
      );
    }, 0);
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    document.body.style.overflow = "hidden";
    dialog.showModal();
    headingRef.current?.focus();
    return () => {
      window.clearTimeout(historyTimer);
      window.removeEventListener("popstate", onPop);
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
      if (window.history.state?.wizardDialog === marker) window.history.back();
    };
  }, [titleId]);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none bg-white p-0 text-ink backdrop:bg-ink/50 sm:m-auto sm:h-auto sm:max-h-[85dvh] sm:max-w-xl sm:rounded-card"
    >
      <div className="flex max-h-[100dvh] flex-col sm:max-h-[85dvh]">
        <header className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver al formulario"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input hover:bg-surface-muted"
          >
            <Icon name="arrow_back" className="text-xl" />
          </button>
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            {title}
          </h2>
        </header>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
