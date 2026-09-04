"use client";

import { useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import type { SocialPlatform } from "@/types";

export type SocialLinkDraft = {
  platform: SocialPlatform;
  url: string;
};

/**
 * Redes sociales del perfil: se elige la red, se pega la dirección y se
 * agrega.
 *
 * Antes eran siete campos siempre visibles, uno por red. Casi nadie usa las
 * siete, así que el paso se veía como un formulario largo y mayormente vacío,
 * y había que recorrerlo entero para encontrar la única que sí se iba a
 * completar. Acá sólo se ve lo que se cargó, y agregar es un gesto explícito.
 *
 * La red agregada sale de la lista y vuelve al quitarla: un perfil tiene una
 * dirección por red, y ofrecer Instagram dos veces sólo permite pisar la que
 * ya está.
 *
 * Cada red cargada viaja como `social_<plataforma>`, que es exactamente lo
 * que la acción ya leía cuando eran campos fijos: el servidor no se entera de
 * que la forma de cargarlas cambió.
 */
export function SocialLinksEditor({
  platforms,
  value,
  onChange,
  error,
}: {
  /** Las redes que ofrece el formulario, en orden. */
  platforms: Array<{ platform: SocialPlatform; label: string }>;
  value: SocialLinkDraft[];
  onChange: (links: SocialLinkDraft[]) => void;
  /** Errores del servidor por plataforma: `socialLinks.instagram`. */
  error?: (platform: SocialPlatform) => string | undefined;
}) {
  const used = new Set(value.map((link) => link.platform));
  const available = platforms.filter((option) => !used.has(option.platform));

  const [platform, setPlatform] = useState<SocialPlatform | "">("");
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const labelOf = (target: SocialPlatform): string =>
    platforms.find((option) => option.platform === target)?.label ?? target;

  function add() {
    const chosen = platform || available[0]?.platform;
    if (!chosen) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setProblem("Escribí la dirección.");
      return;
    }

    /*
     * Un aviso en el momento en vez de esperar al envío. El servidor vuelve a
     * validar igual (RF-163): esto sólo evita agregar algo que ya se sabe que
     * va a volver con error.
     */
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setProblem("La dirección tiene que empezar con http:// o https://");
      return;
    }

    setProblem(null);
    onChange([...value, { platform: chosen, url: trimmed }]);
    setPlatform("");
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Lo cargado viaja con el mismo nombre de campo que cuando eran siete
        inputs fijos.
      */}
      {value.map((link) => (
        <input
          key={link.platform}
          type="hidden"
          name={`social_${link.platform}`}
          value={link.url}
        />
      ))}

      {value.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {value.map((link) => {
            const fieldError = error?.(link.platform);
            return (
              <li
                key={link.platform}
                className="flex flex-col gap-1 rounded-input border border-line bg-surface-muted px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="w-24 flex-none text-[13px] font-semibold text-ink">
                    {labelOf(link.platform)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">
                    {link.url}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        value.filter((item) => item.platform !== link.platform),
                      )
                    }
                    aria-label={`Quitar ${labelOf(link.platform)}`}
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
                {fieldError ? (
                  <p role="alert" className="text-[13px] font-medium text-[#B42318]">
                    {fieldError}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Red social"
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value as SocialPlatform);
              setProblem(null);
            }}
            className="h-11 w-full rounded-input border border-line-strong bg-white px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand-800 sm:w-44 sm:flex-none"
          >
            <option value="">Elegí una red…</option>
            {available.map((option) => (
              <option key={option.platform} value={option.platform}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            aria-label="Dirección"
            type="url"
            value={url}
            maxLength={300}
            placeholder="https://"
            onChange={(event) => {
              setUrl(event.target.value);
              setProblem(null);
            }}
            // Enter agrega la red en vez de enviar el formulario entero.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            className="h-11 w-full min-w-0 flex-1 rounded-input border border-line-strong bg-white px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand-800"
          />

          <button
            type="button"
            onClick={add}
            className={`flex h-11 flex-none items-center justify-center gap-1 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
          >
            <Icon name="add" className="text-[18px]" />
            Agregar
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft">
          Ya cargaste todas las redes disponibles.
        </p>
      )}

      {problem ? (
        <p role="alert" className="text-[13px] font-medium text-[#B42318]">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
