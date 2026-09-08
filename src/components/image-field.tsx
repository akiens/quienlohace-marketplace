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
    /** Las que quedan visibles; ocultar no libera cupo (BR-033). */
    activeIds: string[];
    galleryRevision: string | null;
    selectedIds?: string[];
    removedIds: string[];
    busy: boolean;
  }) => void;
}) {
  const policy = policyFor(field);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [rejected, setRejected] = useState<string[]>([]);

  const upload = useImageUpload({ field, initial, max });
  const galleryRevision = initial[0]?.galleryRevision ?? null;
  const selectionPending = field === "gallery" && initial.some(image => image.gallerySelectionPending);
  const [selected, setSelected] = useState(() => initial.filter(image => image.galleryState === "available" && image.lifecycle === "confirmed").map(image => image.id));
  const [confirmSelection, setConfirmSelection] = useState(false);
  const selectedKey = selected.join(",");

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
  const activeKey = upload.activeIds.join(",");
  const removedKey = upload.removedIds.join(",");
  const { busy } = upload;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current({
      keepIds: keepKey ? keepKey.split(",") : [],
      activeIds: activeKey ? activeKey.split(",") : [],
      galleryRevision,
      selectedIds: confirmSelection ? (selectedKey ? selectedKey.split(",") : []) : undefined,
      removedIds: removedKey ? removedKey.split(",") : [],
      busy,
    });
  }, [keepKey, activeKey, removedKey, busy, galleryRevision, selectedKey, confirmSelection]);

  const single = shape !== "grid";
  const full = selectionPending || (upload.room !== null && upload.room <= 0);

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

      {selectionPending ? (
        <div className="rounded-card border border-warning-line bg-warning-soft p-3">
          <p className="text-sm text-warning-ink">Elegí una sola vez las imágenes que querés conservar en tu galería (hasta {max}). Al confirmar y guardar el formulario, las demás quedarán congeladas y no podrás intercambiarlas.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {initial.filter(image => image.lifecycle === "confirmed").map(image => (
              <label key={image.id} className="flex cursor-pointer flex-col gap-1 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt || "Imagen para conservar"} className="aspect-[4/3] w-full rounded-card object-cover" />
                <span><input type="checkbox" checked={selected.includes(image.id)}
                  disabled={confirmSelection || (!selected.includes(image.id) && max != null && selected.length >= max)}
                  onChange={event => setSelected(current => event.target.checked ? [...current, image.id] : current.filter(id => id !== image.id))} /> Conservar</span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmSelection} onChange={event => setConfirmSelection(event.target.checked)} />
            Confirmo mi selección de {selected.length} imágenes. Se aplicará al guardar el formulario y no podré repetirla.
          </label>
        </div>
      ) : null}

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
          overPlanCount={upload.overPlanCount}
          onPick={() => inputRef.current?.click()}
          onRemove={upload.remove}
          onRetry={upload.retry}
          onMove={upload.move}
          onToggleActive={upload.toggleActive}
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
  overPlanCount,
  onPick,
  onRemove,
  onRetry,
  onMove,
  onToggleActive,
}: {
  items: UploadItem[];
  help: string;
  full: boolean;
  planName?: string;
  max: number | null;
  sortable: boolean;
  overPlanCount: number;
  onToggleActive: (key: string) => void;
  onPick: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
}) {
  const available = items.filter(item => item.hiddenReason !== "plan");
  const active = available.filter(item => item.active);
  const overPlan = items.filter(item => item.hiddenReason === "plan");

  const card = (item: UploadItem, index: number, list: UploadItem[]) => (
    <ImageCard
      key={item.key}
      item={item}
      index={index}
      total={list.length}
      sortable={sortable && item.active}
      canActivate={item.hiddenReason !== "plan"}
      onRemove={onRemove}
      onRetry={onRetry}
      onMove={onMove}
      onToggleActive={onToggleActive}
    />
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {available.map((item, index) => card(item, index, item.active ? active : available))}

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

      {/*
        Fuera del cupo tras una baja: sí caducan, y el aviso lo dice. Es la
        revisión que BR-009 exige poder hacer antes de que se borren.
      */}
      {overPlan.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-card border border-warning-line bg-warning-soft p-3">
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-warning-ink">
            <Icon name="schedule" className="mt-px flex-none text-[15px]" />
            <span>
              <strong className="font-semibold">
                {overPlanCount === 1
                  ? "1 imagen no entra en tu plan"
                  : `${overPlanCount} imágenes no entran en tu plan`}
              </strong>{" "}
              {planName ? `${planName}, que incluye ${max}.` : "actual."} Se
              conservan hasta vencer su plazo de 180 días. Mejorá el plan para recuperarlas.
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {overPlan.map((item, index) => card(item, index, overPlan))}
          </div>
        </div>
      ) : null}

      {/*
        El cupo es de este campo y de ningún otro (BR-007): la galería no se
        achica por tener foto de perfil ni portada. Cuenta las disponibles,
        incluidas las ocultas voluntariamente.
      */}
      <span className="text-[12.5px] leading-relaxed text-ink-faint">
        {full && max !== null
          ? planName
            ? `Llegaste al máximo de tu plan ${planName}: ${max} ${max === 1 ? "imagen" : "imágenes"} en la galería.`
            : `Llegaste al máximo: ${max} ${max === 1 ? "imagen" : "imágenes"}.`
          : help}
      </span>
    </>
  );
}

/**
 * Una imagen de la grilla, con lo que se puede hacer sobre ella.
 *
 * La inactiva se ve atenuada y su acción principal es "Mostrar", no ordenar:
 * mientras esté fuera del cupo su posición no cambia nada.
 */
function ImageCard({
  item,
  index,
  total,
  sortable,
  canActivate,
  onRemove,
  onRetry,
  onMove,
  onToggleActive,
}: {
  item: UploadItem;
  index: number;
  total: number;
  sortable: boolean;
  /** Si hay lugar en el cupo para activarla. */
  canActivate: boolean;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onToggleActive: (key: string) => void;
}) {
  const busy = isBusy(item.status);
  const saved = item.status === "done" && item.image !== null;
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-card border bg-surface-muted ${
          item.active ? "border-line" : "border-line-strong"
        }`}
      >
        <Thumb item={item} />

        {/* La inactiva se ve apagada: se distingue de un vistazo cuál sale. */}
        {!item.active ? (
          <span className="pointer-events-none absolute inset-0 bg-surface-muted/55" />
        ) : null}

        {!item.active && item.hiddenReason !== "plan" ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] font-semibold leading-snug text-ink">
            Oculta en tu perfil público
          </span>
        ) : null}

        <button
          type="button"
          disabled={busy || item.hiddenReason === "plan"}
          onClick={() => void onRemove(item.key)}
          aria-label="Quitar imagen"
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#B42318] shadow-card transition-colors hover:bg-white disabled:opacity-50"
        >
          <Icon name="close" className="text-[17px]" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {sortable && total > 1 ? (
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
              disabled={index === total - 1}
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

        {/* Mostrar u ocultar sólo cambia la visibilidad de una disponible. */}
        {saved && item.hiddenReason !== "plan" ? (
          <button
            type="button"
            disabled={busy || (!item.active && !canActivate)}
            onClick={() => onToggleActive(item.key)}
            title={
              !item.active && !canActivate
                ? "Esta imagen está congelada por el plan."
                : undefined
            }
            className={`ml-auto flex h-7 items-center gap-1 rounded-input px-2 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
              item.active
                ? "text-ink-soft hover:bg-surface-muted"
                : "text-brand-800 hover:bg-surface-muted"
            }`}
          >
            <Icon
              name={item.active ? "visibility_off" : "visibility"}
              className="text-[15px]"
            />
            {item.active ? "Ocultar" : "Mostrar"}
          </button>
        ) : null}
      </div>

      {item.hiddenReason === "plan" ? (
        <span className="text-xs text-warning-ink">
          {item.image?.galleryState === "semi" ? "Semicongelada" : "Congelada"}. {item.image?.hiddenAt
            ? `Eliminación en ${Math.max(0, Math.ceil((new Date(item.image.hiddenAt).getTime() + 180 * 86400000 - now) / 86400000))} días.`
            : "Conservada; aún no hay fecha de eliminación."}
        </span>
      ) : null}
      {item.error ? <ItemError message={item.error} /> : null}
    </div>
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
