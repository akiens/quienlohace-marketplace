"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import { useFieldErrors } from "@/lib/use-field-errors";
import { socialLinkSchema } from "@/lib/validation";
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
  platforms: Array<{ platform: SocialPlatform; label: string; icon: string }>;
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
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const platformMenuRef = useRef<HTMLDivElement>(null);
  const platformMenuId = useId();

  const selectedPlatform = platforms.find(
    (option) => option.platform === platform,
  );

  const validateUrl = useCallback((field: string, candidate: unknown) => {
    const parsed = socialLinkSchema.safeParse({
      platform: field,
      url: candidate,
    });
    return parsed.success ? "" : (parsed.error.issues[0]?.message ?? "");
  }, []);
  const urlErrorState = useFieldErrors(validateUrl);
  const shownUrlError = platform ? urlErrorState.shown[platform] : undefined;

  useEffect(() => {
    if (!platformMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !platformMenuRef.current?.contains(event.target)
      ) {
        setPlatformMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPlatformMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [platformMenuOpen]);

  const labelOf = (target: SocialPlatform): string =>
    platforms.find((option) => option.platform === target)?.label ?? target;

  function add() {
    if (!platform) {
      setProblem("Elegí una red.");
      return;
    }

    const trimmed = url.trim();
    const errors = urlErrorState.submitAll({ [platform]: trimmed });
    if (errors[platform]) return;

    setProblem(null);
    onChange([...value, { platform, url: trimmed }]);
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
                {/*
                  En el teléfono el nombre de la red va arriba de la dirección:
                  con la columna fija de 96px al lado, de la URL se veían
                  cuatro caracteres y no se sabía cuál se había cargado.
                */}
                <div className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-[13px] font-semibold text-ink sm:w-24 sm:flex-none">
                      {labelOf(link.platform)}
                    </span>
                    <span className="min-w-0 truncate text-[13.5px] text-ink-soft sm:flex-1">
                      {link.url}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        value.filter((item) => item.platform !== link.platform),
                      )
                    }
                    aria-label={`Quitar ${labelOf(link.platform)}`}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink sm:h-7 sm:w-7"
                  >
                    <Icon name="close" className="text-[18px] sm:text-[16px]" />
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
          <div
            ref={platformMenuRef}
            className="relative w-full sm:w-44 sm:flex-none"
          >
            <button
              type="button"
              aria-label="Red social"
              aria-haspopup="listbox"
              aria-expanded={platformMenuOpen}
              aria-controls={platformMenuId}
              onClick={() => setPlatformMenuOpen((open) => !open)}
              className="flex h-12 w-full items-center gap-2 rounded-input border border-line-strong bg-white px-3 text-left text-[16px] text-ink outline-none transition-colors focus:border-brand-800 sm:h-11 sm:text-[15px]"
            >
              {selectedPlatform ? (
                <Icon
                  name={selectedPlatform.icon}
                  className="flex-none text-[19px] text-brand-800"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">
                {selectedPlatform?.label ?? "Elegí una red…"}
              </span>
              <Icon
                name={platformMenuOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                className="flex-none text-[20px] text-ink-soft"
              />
            </button>

            {platformMenuOpen ? (
              <ul
                id={platformMenuId}
                role="listbox"
                aria-label="Redes sociales disponibles"
                className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-input border border-line-strong bg-white p-1 shadow-card"
              >
                {available.map((option) => (
                  <li key={option.platform} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlatform(option.platform);
                        setPlatformMenuOpen(false);
                        setProblem(null);
                        if (url) urlErrorState.edit(option.platform, url);
                      }}
                      className="flex min-h-10 w-full items-center gap-2 rounded-input px-2.5 text-left text-[14px] text-ink transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                    >
                      <Icon
                        name={option.icon}
                        className="flex-none text-[19px] text-brand-800"
                      />
                      <span>{option.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <input
            aria-label="Dirección"
            type="url"
            value={url}
            maxLength={300}
            placeholder="https://"
            onChange={(event) => {
              setUrl(event.target.value);
              setProblem(null);
              if (platform) urlErrorState.edit(platform, event.target.value);
            }}
            onBlur={(event) => {
              if (platform) urlErrorState.blur(platform, event.target.value);
            }}
            aria-invalid={shownUrlError ? true : undefined}
            aria-describedby={shownUrlError ? "social-url-error" : undefined}
            // Enter agrega la red en vez de enviar el formulario entero.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            className="h-12 w-full min-w-0 flex-1 rounded-input border border-line-strong bg-white px-3 text-[16px] text-ink outline-none transition-colors focus:border-brand-800 sm:h-11 sm:text-[15px]"
          />

          <button
            type="button"
            onClick={add}
            className={`flex h-12 flex-none items-center justify-center gap-1 rounded-input px-4 text-[15px] font-semibold sm:h-11 sm:text-[14px] ${SECONDARY_SURFACE}`}
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

      {shownUrlError ? (
        <p
          id="social-url-error"
          role="alert"
          className="text-[13px] font-medium text-[#B42318]"
        >
          {shownUrlError}
        </p>
      ) : null}
    </div>
  );
}
