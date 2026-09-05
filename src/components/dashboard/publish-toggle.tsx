"use client";

import { useTransition } from "react";

import { setProfileStatus } from "@/app/actions/profile";
import { Icon } from "@/components/ui";
import type { ProfileStatus } from "@/types";

/** Publica o despublica el perfil. La autorización se verifica en el servidor. */
export function PublishToggle({ status }: { status: ProfileStatus }) {
  const [pending, startTransition] = useTransition();
  const published = status === "active";

  /*
    Suspender es una decisión de moderación y no la revierte el proveedor
    (BR-029). `pending_verification` ya no existe como estado del perfil: la
    verificación comercial vive en `verification_status`, que es otra cosa
    (BR-019).
  */
  if (status === "suspended") {
    return (
      <span className="flex h-10 items-center gap-2 rounded-input bg-surface-sunken px-4 text-[14px] font-semibold text-ink-soft">
        <Icon name="gavel" className="text-[17px]" />
        Perfil suspendido
      </span>
    );
  }

  /*
   * Un interruptor, no dos botones distintos: lo que se lee es el estado en
   * que está el perfil, y tocarlo lo cambia. `aria-pressed` es lo que hace que
   * un lector de pantalla lo anuncie como interruptor y no como botón suelto.
   */
  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      aria-label="Perfil público"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setProfileStatus(published ? "inactive" : "active");
        })
      }
      className={`flex h-10 items-center gap-2 rounded-input px-4 text-[14px] font-bold transition-colors disabled:opacity-60 ${
        published
          ? "bg-brand-800 text-white hover:bg-brand-900"
          : "border border-line-strong bg-white text-ink hover:bg-surface-muted"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors ${
          published ? "bg-white/30" : "bg-line-strong"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            published ? "translate-x-4" : ""
          }`}
        />
      </span>
      {pending ? "Guardando…" : published ? "Publicado" : "Publicar"}
    </button>
  );
}
