"use client";

import { useTransition } from "react";

import { setProfileStatus } from "@/app/actions/profile";
import { Icon } from "@/components/ui";
import type { ProviderStatus } from "@/types";

/** Publica o despublica el perfil. La autorización se verifica en el servidor. */
export function PublishToggle({ status }: { status: ProviderStatus }) {
  const [pending, startTransition] = useTransition();
  const published = status === "active";

  // Los estados de moderación no los cambia el proveedor.
  if (status === "suspended" || status === "pending_verification") {
    return (
      <span className="flex h-10 items-center gap-2 rounded-input bg-surface-sunken px-4 text-[14px] font-semibold text-ink-soft">
        <Icon name="gavel" className="text-[17px]" />
        {status === "suspended" ? "Perfil suspendido" : "En revisión"}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setProfileStatus(published ? "inactive" : "active");
        })
      }
      className={`flex h-10 items-center gap-2 rounded-input px-4 text-[14px] font-bold transition-colors disabled:opacity-60 ${
        published
          ? "border border-line-strong bg-white text-ink hover:bg-surface-muted"
          : "bg-accent text-ink hover:bg-accent-hover"
      }`}
    >
      <Icon
        name={published ? "visibility_off" : "public"}
        className="text-[17px]"
      />
      {pending ? "Guardando…" : published ? "Despublicar" : "Publicar perfil"}
    </button>
  );
}
