"use client";

import { useRef, useState, useTransition } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import type { ImageKind, ProviderImage } from "@/types";

/**
 * Carga de imágenes del perfil (RF-167).
 *
 * Cada archivo se sube apenas se elige, en su propia acción, y no junto con
 * el resto del formulario: un `File` no sobrevive a una recarga ni entra en
 * el borrador de `localStorage`. Subiendo al instante, la foto queda guardada
 * aunque el alta se termine más tarde.
 *
 * Lo que se ve mientras viaja es el archivo local (`URL.createObjectURL`) y
 * no la imagen ya servida: evita el hueco entre elegir el archivo y que R2
 * empiece a responder por esa clave.
 */

/** Lo mismo que acepta el servidor; acá sólo filtra el diálogo de archivos. */
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * El mismo tope que aplica el servidor, comprobado también acá.
 *
 * No es la validación que cuenta —esa es la del servidor (RF-163)— pero un
 * archivo que se sabe de antemano que va a ser rechazado no vale la pena
 * subirlo: se avisa al instante en vez de después de esperar la subida.
 */
const MAX_BYTES = 5 * 1024 * 1024;

const TOO_LARGE = "La imagen no puede pesar más de 5 MB.";

/**
 * Aviso cuando la subida se corta sin respuesta del servidor.
 *
 * Pasa si se pierde la conexión, y también si el cuerpo supera el tope del
 * framework: en los dos casos la promesa lanza en vez de devolver un error,
 * y sin esto el recuadro se quedaba en «Subiendo…» para siempre.
 */
const UPLOAD_FAILED =
  "No pudimos subir la imagen. Revisá tu conexión y probá de nuevo.";

/** Respuesta de la ruta de imágenes. */
type UploadResult =
  | { ok: true; image: ProviderImage }
  | { ok: false; error: string };

/**
 * Sube un archivo a `/api/profile-images`.
 *
 * Va por `fetch` a una ruta y no por Server Action: una acción llamada como
 * función normal serializa sus argumentos con devalue, que no admite `File`
 * ni `FormData`. La ruta recibe el multipart tal cual.
 */
async function upload(kind: ImageKind, file: File): Promise<UploadResult> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);

  const response = await fetch("/api/profile-images", { method: "POST", body });

  /*
   * El cuerpo se lee siempre: la ruta manda el motivo también cuando
   * responde con error, y es el que hay que mostrar. Si ni siquiera es JSON
   * —un 502 de un proxy, por ejemplo— queda el aviso genérico.
   */
  const result = (await response.json().catch(() => null)) as UploadResult | null;
  if (!result) return { ok: false, error: UPLOAD_FAILED };
  return result;
}

/** Borra una imagen por su id. */
async function destroy(imageId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `/api/profile-images?id=${encodeURIComponent(imageId)}`,
    { method: "DELETE" },
  );

  const result = (await response.json().catch(() => null)) as
    | { ok: boolean; error?: string }
    | null;
  return result ?? { ok: false, error: UPLOAD_FAILED };
}

/**
 * Una imagen única del perfil: la foto y la portada.
 *
 * Las dos se comportan igual —una sola, que se reemplaza— y sólo cambian de
 * forma, así que comparten componente y se distinguen por `shape`.
 */
export function SingleImageField({
  kind,
  image,
  shape,
  label,
  hint,
  onChange,
}: {
  kind: Extract<ImageKind, "avatar" | "cover">;
  image: ProviderImage | null;
  shape: "circle" | "wide";
  label: string;
  hint: string;
  onChange: (image: ProviderImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = preview ?? image?.url ?? null;

  function pick(file: File | undefined) {
    if (!file) return;

    setError(null);

    // Se corta acá: mandar 20 MB para que el servidor los rechace es hacer
    // esperar una subida entera para llegar al mismo aviso.
    if (file.size > MAX_BYTES) {
      setError(TOO_LARGE);
      return;
    }

    // Se muestra el archivo local mientras viaja: la respuesta puede tardar y
    // un recuadro vacío haría dudar de si se eligió algo.
    setPreview(URL.createObjectURL(file));

    startTransition(async () => {
      try {
        const result = await upload(kind, file);
        if (result.ok) {
          onChange(result.image);
        } else {
          // Falló: se vuelve a lo que había, para no dejar a la vista una
          // imagen que en realidad no se guardó.
          setPreview(null);
          setError(result.error);
        }
      } catch {
        setPreview(null);
        setError(UPLOAD_FAILED);
      }
    });
  }

  function remove() {
    if (!image) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await destroy(image.id);
        if (!result.ok) {
          setError(result.error ?? UPLOAD_FAILED);
          return;
        }
        setPreview(null);
        onChange(null);
      } catch {
        setError(UPLOAD_FAILED);
      }
    });
  }

  const box =
    shape === "circle"
      ? "h-[104px] w-[104px] rounded-full"
      : "h-[104px] w-full rounded-card sm:h-[132px]";

  return (
    <fieldset className="flex w-full flex-col gap-1.5">
      <legend className="mb-1.5 text-[13.5px] font-semibold text-ink-muted">
        {label}
      </legend>

      <div className="flex w-full flex-wrap items-center gap-4">
        <div
          className={`relative flex items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface-muted ${
            shape === "circle" ? "flex-none" : "min-w-[200px] flex-1"
          } ${box}`}
        >
          {shown ? (
            /*
              `next/image` no entra acá: la fuente es un blob local mientras
              sube y una ruta propia después. Ninguna de las dos se beneficia
              del optimizador, y el blob directamente no puede pasar por él.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className={`h-full w-full object-cover ${pending ? "opacity-60" : ""}`}
            />
          ) : (
            <Icon
              name={shape === "circle" ? "person" : "image"}
              className="text-[30px] text-ink-faint"
            />
          )}

          {pending ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/50 text-[12px] font-semibold text-ink">
              Subiendo…
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              // Se limpia para que volver a elegir el mismo archivo dispare
              // el cambio otra vez.
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className={`flex h-8 items-center gap-1 rounded-input pl-1.5 pr-2.5 text-[13px] font-semibold disabled:opacity-50 ${SECONDARY_SURFACE}`}
            >
              <Icon name={shown ? "sync" : "upload"} className="text-[16px]" />
              {shown ? "Cambiar" : "Subir"}
            </button>

            {image ? (
              <button
                type="button"
                disabled={pending}
                onClick={remove}
                className="flex h-8 items-center gap-1 rounded-input px-2 text-[13px] font-semibold text-[#B42318] transition-colors hover:bg-[#FFFBFA] disabled:opacity-50"
              >
                <Icon name="delete" className="text-[16px]" />
                Quitar
              </button>
            ) : null}
          </div>

          <span className="max-w-[240px] text-[12.5px] leading-relaxed text-ink-faint">
            {hint}
          </span>
        </div>
      </div>

      {error ? (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]">
          <Icon name="error" className="text-[15px]" />
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

/**
 * Galería de trabajos: varias imágenes, con el tope del plan.
 *
 * Sólo se monta cuando el plan la incluye. El servidor vuelve a comprobarlo
 * al recibir cada archivo: esconder el campo es una ayuda, no un permiso
 * (RF-163).
 */
export function GalleryField({
  images,
  max,
  planName,
  onChange,
}: {
  images: ProviderImage[];
  max: number;
  planName: string;
  onChange: (images: ProviderImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [pending, startTransition] = useTransition();

  const full = images.length + uploading >= max;

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);

    // Sólo las que entran en el plan: mandar el resto para que el servidor
    // las rechace de a una sería hacer esperar una tanda de errores.
    const room = max - images.length;
    const chosen = Array.from(files).slice(0, room);
    if (chosen.length < files.length) {
      setError(`Tu plan ${planName} permite hasta ${max} imágenes.`);
    }
    if (chosen.length === 0) return;

    // Las que superan el tope se apartan antes de subir nada, igual que en la
    // foto de perfil: el resto de la tanda sigue su curso.
    const tooLarge = chosen.filter((file) => file.size > MAX_BYTES);
    const sendable = chosen.filter((file) => file.size <= MAX_BYTES);
    if (tooLarge.length > 0) setError(TOO_LARGE);
    if (sendable.length === 0) return;

    setUploading(sendable.length);

    startTransition(async () => {
      const added: ProviderImage[] = [];

      // De a una y en orden: así la posición que asigna el servidor coincide
      // con el orden en que se eligieron.
      for (const file of sendable) {
        try {
          const result = await upload("gallery", file);
          if (result.ok) {
            added.push(result.image);
          } else {
            setError(result.error);
            break;
          }
        } catch {
          // Se corta la tanda: si falló la conexión, las que siguen van a
          // fallar igual. Lo que ya entró se conserva.
          setError(UPLOAD_FAILED);
          break;
        }
      }

      setUploading(0);
      if (added.length > 0) onChange([...images, ...added]);
    });
  }

  function remove(imageId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await destroy(imageId);
        if (!result.ok) {
          setError(result.error ?? UPLOAD_FAILED);
          return;
        }
        onChange(images.filter((image) => image.id !== imageId));
      } catch {
        setError(UPLOAD_FAILED);
      }
    });
  }

  return (
    <fieldset className="flex w-full flex-col gap-1.5">
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-ink-muted">
          Galería de trabajos
        </span>
        <span className="text-[12px] tabular-nums text-ink-faint">
          {images.length}/{max}
        </span>
      </legend>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.alt}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              aria-label="Quitar imagen"
              disabled={pending}
              onClick={() => remove(image.id)}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#B42318] shadow-card transition-colors hover:bg-white disabled:opacity-50"
            >
              <Icon name="delete" className="text-[16px]" />
            </button>
          </div>
        ))}

        {/* Recuadros de lo que está subiendo: el tope se lee completo
            mientras los archivos viajan. */}
        {Array.from({ length: uploading }, (_, index) => (
          <div
            key={`subiendo-${index}`}
            className="flex aspect-[4/3] items-center justify-center rounded-card border border-dashed border-line-strong bg-surface-muted text-[12px] font-semibold text-ink-soft"
          >
            Subiendo…
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line-strong bg-white text-[13px] font-semibold text-brand-800 transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <Icon name="add_photo_alternate" className="text-[22px]" />
            Agregar
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]">
          <Icon name="error" className="text-[15px]" />
          {error}
        </span>
      ) : (
        <span className="text-[12.5px] text-ink-faint">
          Mostrá tus trabajos. Tu plan {planName} permite hasta {max} imágenes.
        </span>
      )}
    </fieldset>
  );
}
