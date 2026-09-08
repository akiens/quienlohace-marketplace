"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import {
  acceptAttribute,
  formatAccepted,
  formatBytes,
  policyFor,
  type ImageField as ImageFieldName,
} from "@/domain/image-policy";
import {
  isBusy,
  statusLabel,
  useImageUpload,
  type UploadItem,
} from "@/lib/use-image-upload";
import type { ProfileImage } from "@/types";

/**
 * Un campo de imagen, para cualquier formulario (TR-042, TR-043).
 *
 * No sabe de perfiles ni de planes: recibe el nombre del campo —de donde
 * salen todos los límites—, lo que ya está guardado y un tope opcional. Un
 * formulario nuevo lo monta con otro campo y funciona igual.
 *
 * La forma la decide `shape`, que es lo único visual que cambia entre un
 * avatar redondo, una portada apaisada y una grilla de galería.
 */
export function ImageField({
  field,
  label,
  hint,
  shape,
  initial,
  max,
  planName,
  onChange,
}: {
  field: ImageFieldName;
  label: string;
  hint?: string;
  shape: "circle" | "wide" | "grid";
  /** Lo que ya está guardado. */
  initial: ProfileImage[];
  /** Tope efectivo cuando lo pone el plan y no la política. */
  max?: number | null;
  /** Para el aviso de cupo lleno. */
  planName?: string;
  /**
   * Avisa al formulario qué imágenes quedan y cuáles se quitaron, para que
   * las mande al guardar. También si hay algo en curso: mientras lo haya, el
   * botón de guardar tiene que estar apagado (TR-043).
   */
  onChange: (state: {
    keepIds: string[];
    removedIds: string[];
    busy: boolean;
  }) => void;
}) {
  const policy = policyFor(field);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [rejected, setRejected] = useState<string[]>([]);

  const upload = useImageUpload({ field, initial, max });

  /*
   * Se le avisa al formulario cuál es la selección de este campo.
   *
   * Va en un efecto porque avisar es actualizar el estado de **otro**
   * componente, y eso no se puede hacer durante el render. Las dependencias
   * son cadenas y no los arrays: `keepIds` es nuevo en cada render aunque
   * tenga los mismos ids, y compararlo por identidad dispararía el efecto sin
   * parar.
   *
   * `onChange` queda fuera a propósito: quien monta esto suele escribirla en
   * línea, así que cambia de identidad en cada render y volvería a lo mismo.
   */
  const keepKey = upload.keepIds.join(",");
  const removedKey = upload.removedIds.join(",");
  const { busy } = upload;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current({
      keepIds: keepKey ? keepKey.split(",") : [],
      removedIds: removedKey ? removedKey.split(",") : [],
      busy,
    });
  }, [keepKey, removedKey, busy]);

  const single = shape !== "grid";
  const full = upload.room !== null && upload.room <= 0;

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setRejected([]);
    const problems = await upload.add(Array.from(files));
    setRejected(problems);
  }

  const help =
    hint ??
    `${formatAccepted(field)}, hasta ${formatBytes(policy.maxBytes)}.`;

  return (
    <fieldset className="flex w-full flex-col gap-2">
      <legend className="mb-1.5 text-[13.5px] font-semibold text-ink-muted">
        {label}
      </legend>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttribute(field)}
        multiple={!single}
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files);
          // Se limpia para que volver a elegir el mismo archivo dispare el
          // cambio otra vez.
          event.target.value = "";
        }}
      />

      {single ? (
        <SingleLayout
          item={upload.items[0] ?? null}
          shape={shape as "circle" | "wide"}
          help={help}
          onPick={() => inputRef.current?.click()}
          onRemove={upload.remove}
          onRetry={upload.retry}
        />
      ) : (
        <GridLayout
          items={upload.items}
          help={help}
          full={full}
          planName={planName}
          max={max ?? policy.maxCount}
          sortable={policy.sortable}
          onPick={() => inputRef.current?.click()}
          onRemove={upload.remove}
          onRetry={upload.retry}
          onMove={upload.move}
        />
      )}

      {rejected.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {rejected.map((problem) => (
            <li
              key={problem}
              role="alert"
              className="flex items-start gap-1.5 text-[12.5px] font-medium text-[#B42318]"
            >
              <Icon name="error" className="mt-px flex-none text-[15px]" />
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

/** Una sola imagen: la foto de perfil y la portada. */
function SingleLayout({
  item,
  shape,
  help,
  onPick,
  onRemove,
  onRetry,
}: {
  item: UploadItem | null;
  shape: "circle" | "wide";
  help: string;
  onPick: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  const box =
    shape === "circle"
      ? "h-[104px] w-[104px] rounded-full"
      : "h-[104px] w-full rounded-card sm:h-[132px]";

  const busy = item ? isBusy(item.status) : false;

  return (
    <>
      {/*
        La foto de perfil va al lado de sus botones —es un círculo chico y
        sobra el ancho—, y la portada arriba de ellos: es una franja que ocupa
        todo el ancho, y al lado dejaba los botones en una columna de cien
        píxeles con el texto partido letra por letra.
      */}
      <div
        className={`flex w-full gap-4 ${
          shape === "circle" ? "items-center" : "flex-col sm:flex-row sm:items-center"
        }`}
      >
        <div
          className={`relative flex items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface-muted ${
            shape === "circle" ? "flex-none" : "w-full sm:min-w-[200px] sm:flex-1"
          } ${box}`}
        >
          {item ? (
            <Thumb item={item} />
          ) : (
            <Icon
              name={shape === "circle" ? "person" : "image"}
              className="text-[30px] text-ink-faint"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onPick}
              className={`flex h-11 items-center gap-1 rounded-input px-3 text-[14px] font-semibold disabled:opacity-50 sm:h-8 sm:pl-1.5 sm:pr-2.5 sm:text-[13px] ${SECONDARY_SURFACE}`}
            >
              <Icon name={item ? "sync" : "upload"} className="text-[16px]" />
              {item ? "Cambiar" : "Subir"}
            </button>

            {item?.status === "error" ? (
              <button
                type="button"
                onClick={() => onRetry(item.key)}
                className={`flex h-11 items-center gap-1 rounded-input px-3 text-[14px] font-semibold sm:h-8 sm:px-2.5 sm:text-[13px] ${SECONDARY_SURFACE}`}
              >
                <Icon name="refresh" className="text-[16px]" />
                Reintentar
              </button>
            ) : null}

            {item ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRemove(item.key)}
                className="flex h-11 items-center gap-1 rounded-input px-3 text-[14px] font-semibold text-[#B42318] transition-colors hover:bg-[#FFFBFA] disabled:opacity-50 sm:h-8 sm:px-2 sm:text-[13px]"
              >
                <Icon name="delete" className="text-[16px]" />
                Quitar
              </button>
            ) : null}
          </div>

          <span className="text-[12.5px] leading-relaxed text-ink-faint sm:max-w-[240px]">
            {help}
          </span>
        </div>
      </div>

      {item?.error ? <ItemError message={item.error} /> : null}
    </>
  );
}

/** Varias imágenes en grilla: la galería. */
function GridLayout({
  items,
  help,
  full,
  planName,
  max,
  sortable,
  onPick,
  onRemove,
  onRetry,
  onMove,
}: {
  items: UploadItem[];
  help: string;
  full: boolean;
  planName?: string;
  max: number | null;
  sortable: boolean;
  onPick: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.key} className="flex flex-col gap-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-muted">
              <Thumb item={item} />

              <button
                type="button"
                disabled={isBusy(item.status)}
                onClick={() => void onRemove(item.key)}
                aria-label="Quitar imagen"
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#B42318] shadow-card transition-colors hover:bg-white disabled:opacity-50"
              >
                <Icon name="close" className="text-[17px]" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {sortable && items.length > 1 ? (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMove(item.key, -1)}
                    aria-label="Mover antes"
                    className="flex h-7 w-7 items-center justify-center rounded-input text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    <Icon name="arrow_back" className="text-[16px]" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => onMove(item.key, 1)}
                    aria-label="Mover después"
                    className="flex h-7 w-7 items-center justify-center rounded-input text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </button>
                </>
              ) : null}

              {item.status === "error" ? (
                <button
                  type="button"
                  onClick={() => onRetry(item.key)}
                  className="ml-auto flex h-7 items-center gap-1 rounded-input px-2 text-[12px] font-semibold text-brand-800 transition-colors hover:bg-surface-muted"
                >
                  <Icon name="refresh" className="text-[15px]" />
                  Reintentar
                </button>
              ) : null}
            </div>

            {item.error ? <ItemError message={item.error} /> : null}
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            onClick={onPick}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong bg-surface-muted text-ink-soft transition-colors hover:border-brand-600 hover:text-brand-800"
          >
            <Icon name="add_photo_alternate" className="text-[26px]" />
            <span className="text-[12.5px] font-semibold">Agregar</span>
          </button>
        ) : null}
      </div>

      <span className="text-[12.5px] leading-relaxed text-ink-faint">
        {full && max !== null
          ? planName
            ? `Llegaste al máximo de tu plan ${planName}: ${max} ${max === 1 ? "imagen" : "imágenes"}.`
            : `Llegaste al máximo: ${max} ${max === 1 ? "imagen" : "imágenes"}.`
          : help}
      </span>
    </>
  );
}

/** La vista previa con su estado encima. */
function Thumb({ item }: { item: UploadItem }) {
  const busy = isBusy(item.status);

  return (
    <>
      {/*
        `next/image` no entra acá: la fuente es un blob local mientras sube y
        una ruta propia después. Ninguna de las dos se beneficia del
        optimizador, y el blob directamente no puede pasar por él.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt=""
        className={`h-full w-full object-cover ${
          busy ? "opacity-60" : item.status === "error" ? "opacity-40" : ""
        }`}
      />

      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-[12px] font-semibold text-ink">
          {statusLabel(item.status)}
        </span>
      ) : null}

      {item.status === "error" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-[#FEF3F2]/80">
          <Icon name="error" className="text-[22px] text-[#B42318]" />
        </span>
      ) : null}
    </>
  );
}

function ItemError({ message }: { message: string }) {
  return (
    <span
      role="alert"
      className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-[#B42318]"
    >
      <Icon name="error" className="mt-px flex-none text-[14px]" />
      {message}
    </span>
  );
}
