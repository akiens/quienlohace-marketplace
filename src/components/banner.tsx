"use client";

import { useState } from "react";

import { Icon } from "@/components/ui";

/**
 * El tono del aviso. Decide el color y, si no se pasa otro, el icono.
 *
 * Son los cuatro que el sitio ya usaba con literales repetidos, ahora con
 * nombre: `info` es el amarillo de `accent` —el de los avisos del panel—,
 * y los otros tres salen de los tokens semánticos de Tailwind.
 */
export type BannerTone = "info" | "success" | "warning" | "error";

const TONES: Record<BannerTone, { className: string; icon: string }> = {
  info: {
    className: "border-accent bg-accent-soft text-accent-ink",
    icon: "info",
  },
  success: {
    className: "border-success-line bg-success-soft text-success-ink",
    icon: "check_circle",
  },
  warning: {
    className: "border-warning-line bg-warning-soft text-warning-ink",
    icon: "warning",
  },
  error: {
    className: "border-danger-line bg-danger-soft text-danger-ink",
    icon: "error",
  },
};

/**
 * Un aviso a lo ancho del sitio, para ir justo debajo del encabezado.
 *
 * Se dibuja donde se monta, y va **primero** en la página para quedar pegado
 * al encabezado. Se probó con un portal a un hueco del layout —así el lugar en
 * el árbol no importaría—, pero el portal sólo actúa en el cliente: el aviso
 * desaparecía del HTML del servidor y entraba de golpe al hidratar, corriendo
 * el contenido hacia abajo. Llenar ese hueco desde el layout tampoco sirve:
 * obligaría a leer la sesión ahí y volvería dinámico todo el sitio, que es lo
 * que hoy mantiene estáticas las páginas públicas.
 *
 * Va de borde a borde y sin esquinas redondeadas: es una banda del sitio, no
 * una tarjeta del contenido, y la forma es lo que hace la diferencia legible.
 */
export function Banner({
  tone = "info",
  icon,
  children,
  onDismiss,
  onBeforeDismiss,
}: {
  tone?: BannerTone;
  /** Icono propio. Por defecto, el del tono. */
  icon?: string;
  /**
   * El mensaje. Admite marcado —`<strong>`, enlaces— porque muchos avisos
   * necesitan destacar una fecha o un nombre dentro de la frase.
   */
  children: React.ReactNode;
  /** Se llama después de cerrar. Para avisar a quien lo montó. */
  onDismiss?: () => void;
  /**
   * Se ejecuta **antes** de cerrar, para lo que haya que dejar hecho: anotar
   * en el servidor que ya se leyó, por ejemplo.
   *
   * No se espera su promesa para ocultar el aviso: cerrar tiene que sentirse
   * inmediato, y una escritura lenta dejaría el cartel puesto un rato después
   * del clic. Si falla, el aviso ya se fue y a lo sumo vuelve en la próxima
   * visita — que es preferible a bloquear la interfaz por eso.
   */
  onBeforeDismiss?: () => void | Promise<void>;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const { className, icon: toneIcon } = TONES[tone];

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 border-b px-5 py-3 text-[14px] leading-relaxed sm:px-6 ${className}`}
    >
      <Icon name={icon ?? toneIcon} className="mt-0.5 shrink-0 text-[18px]" />

      <p className="min-w-0 flex-1">{children}</p>

      <button
        type="button"
          aria-label="Cerrar aviso"
          onClick={() => {
            // Primero se va de la pantalla; lo demás corre por detrás.
            setDismissed(true);
            void onBeforeDismiss?.();
            onDismiss?.();
          }}
          /*
           * 36px alrededor de la cruz: con el icono a secas se le erraba en el
           * teléfono y el aviso se quedaba puesto.
           */
          className="-my-1 -mr-2 flex h-9 w-9 flex-none items-center justify-center rounded-input transition-colors hover:bg-black/5"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
