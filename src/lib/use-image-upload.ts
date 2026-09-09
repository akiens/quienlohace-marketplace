"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatAccepted,
  formatBytes,
  policyFor,
  sniffFormat,
  type ImageField,
} from "@/domain/image-policy";
import type { ProfileImage } from "@/types";

/**
 * El ciclo de vida de las imágenes de un campo, del lado del navegador
 * (TR-042, TR-043).
 *
 * Sirve para cualquier campo de imagen: qué acepta, cuántas y de qué tamaño
 * lo dice la política, no este archivo. Un campo nuevo se declara en
 * `image-policy.ts` y usa esto sin cambios.
 *
 * Lo que resuelve, y por lo que conviene no reimplementarlo por formulario:
 *
 * - Cada archivo se sube apenas se elige, no al guardar. Un `File` no
 *   sobrevive a una recarga ni entra en el borrador de `localStorage`.
 * - Cada imagen tiene su propio estado: una que falla no arrastra a las
 *   demás ni pierde lo que ya está escrito en el formulario.
 * - Se reduce en el navegador antes de subir, cuando se puede. Bajar de 4 MB
 *   a 300 KB antes de salir a la red es la diferencia entre esperar y no
 *   esperar en un teléfono.
 * - Las vistas previas se liberan solas: un `objectURL` que nadie revoca es
 *   memoria retenida hasta recargar la página.
 */

/** En qué punto del camino está una imagen. */
export type UploadStatus =
  | "preparing"
  | "optimizing"
  | "uploading"
  | "done"
  | "error"
  | "removing";

/** Una imagen del campo, esté subida o en camino. */
export type UploadItem = {
  /** Id local, estable durante toda la vida del ítem. */
  key: string;
  status: UploadStatus;
  /** Lo que se dibuja: el blob local mientras sube, la URL servida después. */
  previewUrl: string;
  /** La fila ya creada en el servidor. `null` hasta que la subida termina. */
  image: ProfileImage | null;
  error: string | null;
  /** El archivo original, para poder reintentar sin volver a elegirlo. */
  file: File | null;
  /**
   * Si se muestra en el perfil público (BR-033); no determina el cupo.
   *
   * No tiene nada que ver con la subida —eso lo lleva `status`—: una imagen
   * deja de mostrarse porque la ocultó su dueño o porque no entra en el plan.
   * En los dos casos sigue guardada.
   */
  active: boolean;
  /**
   * Por qué no se muestra (BR-009). `owner` la ocultó el proveedor y no se
   * borra nunca; `plan` no entra en el plan vigente y caduca a los 180 días.
   */
  hiddenReason: "owner" | "plan" | null;
};

const STATUS_LABELS: Record<UploadStatus, string> = {
  preparing: "Preparando…",
  optimizing: "Optimizando…",
  uploading: "Subiendo…",
  done: "Lista",
  error: "Error",
  removing: "Quitando…",
};

export function statusLabel(status: UploadStatus): string {
  return STATUS_LABELS[status];
}

/** Los estados en los que todavía no se puede guardar el formulario. */
export function isBusy(status: UploadStatus): boolean {
  return status === "preparing" || status === "optimizing" ||
    status === "uploading" || status === "removing";
}

const UPLOAD_FAILED =
  "No pudimos subir la imagen. Revisá tu conexión y probá de nuevo.";

type UploadResponse =
  | { ok: true; image: ProfileImage }
  | { ok: false; error: string };

/**
 * Reduce y recomprime en el navegador antes de subir.
 *
 * No sustituye al procesamiento del servidor —el cliente se puede manipular y
 * lo que llegue se vuelve a validar y regenerar igual (TR-042)—: esto es sólo
 * para no mandar 4 MB cuando alcanzan 300 KB.
 *
 * Devuelve el archivo original si algo no sale: un canvas puede fallar por
 * memoria en un teléfono, y en ese caso es mejor subir el original que no
 * subir nada.
 */
async function optimizeInBrowser(
  file: File,
  field: ImageField,
): Promise<File> {
  const policy = policyFor(field);

  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    /*
     * `imageOrientation: "from-image"` aplica la rotación del EXIF al
     * decodificar. Sin eso, una foto sacada de costado con el teléfono se
     * sube acostada: el canvas dibuja los píxeles crudos y se pierde la
     * etiqueta que decía cómo mirarlos.
     */
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, policy.maxDimension / longest);

    // Ya es chica y liviana: recomprimirla sólo la haría perder calidad.
    if (scale === 1 && file.size <= 512 * 1024) return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/webp", policy.quality / 100);
    });

    // Si la "optimización" engordó el archivo, no sirvió de nada.
    if (!blob || blob.size >= file.size) return file;

    /*
     * Dibujar en un canvas descarta los metadatos por completo, incluida la
     * ubicación GPS. El servidor los vuelve a quitar igual, pero así ni
     * siquiera salen del dispositivo.
     */
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

/**
 * Comprobaciones inmediatas, antes de gastar red (TR-042).
 *
 * No es la validación que cuenta —esa es la del servidor— pero un archivo que
 * ya se sabe que va a ser rechazado no vale la pena subirlo: se avisa al
 * instante en vez de después de esperar la subida entera.
 */
async function validateLocally(
  file: File,
  field: ImageField,
): Promise<string | null> {
  const policy = policyFor(field);

  if (file.size === 0) return "El archivo está vacío.";

  if (file.size > policy.maxBytes) {
    return `La imagen no puede pesar más de ${formatBytes(policy.maxBytes)}.`;
  }

  /*
   * La firma binaria, no la extensión ni el `type` que declara el navegador:
   * renombrar un archivo no lo convierte en una imagen. Es la misma
   * comprobación que hace el servidor, adelantada.
   */
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = sniffFormat(head);

  if (!format || !policy.accept.includes(format)) {
    return `Formato no admitido. Usá ${formatAccepted(field)}.`;
  }

  // Las dimensiones, si el navegador puede decodificarla.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const smallest = Math.min(bitmap.width, bitmap.height);
      bitmap.close();

      if (smallest < policy.minDimension) {
        return `La imagen es muy chica: necesita al menos ${policy.minDimension} píxeles de lado.`;
      }
    } catch {
      return "El archivo está dañado o no es una imagen que podamos leer.";
    }
  }

  return null;
}

/** Huella para detectar el mismo archivo elegido dos veces. */
function fingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

let counter = 0;
const nextKey = () => `img-${++counter}-${Date.now()}`;

/**
 * Gestiona las imágenes de un campo.
 *
 * @param field   Qué campo es: de ahí salen todos los límites.
 * @param initial Las que ya están guardadas, para arrancar mostrándolas.
 * @param max     Tope efectivo, cuando lo pone el plan y no la política.
 */
export function useImageUpload({
  field,
  initial,
  max,
  endpoint = "/api/profile-images",
}: {
  field: ImageField;
  initial: ProfileImage[];
  max?: number | null;
  endpoint?: string;
}) {
  const policy = policyFor(field);
  /*
   * El cupo es **de este campo** (BR-007): la galería no se achica por tener
   * foto de perfil ni portada, que van aparte y las incluyen todos los planes.
   * `max` lo pasa quien monta el campo cuando el tope viene del plan; si no,
   * manda el de la política.
   */
  const limit = max ?? policy.maxCount;

  const [items, setItems] = useState<UploadItem[]>(() =>
    initial.map((image) => ({
      key: image.id,
      status: "done" as const,
      previewUrl: image.url,
      image,
      error: null,
      file: null,
      active: image.isActive,
      hiddenReason: image.hiddenReason,
    })),
  );

  /**
   * Las confirmadas que se quitaron durante esta edición.
   *
   * No se borran acá: quitarlas es una intención que aplica el guardado
   * (TR-043). Hasta entonces el archivo sigue donde está, que es lo que
   * permite cancelar sin haber perdido nada.
   */
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  /*
   * Los `objectURL` vivos, para revocarlos. Un blob que nadie revoca queda
   * retenido hasta recargar la página, y en un campo de galería con varias
   * fotos grandes eso se nota.
   */
  const objectUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  /** Aborta la subida en curso de un ítem que se quita a mitad de camino. */
  const controllers = useRef<Map<string, AbortController>>(new Map());

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  /** Sube un archivo ya validado. Se reusa para el reintento. */
  const send = useCallback(
    async (key: string, file: File) => {
      const controller = new AbortController();
      controllers.current.set(key, controller);

      try {
        patch(key, { status: "optimizing", error: null });
        const optimized = await optimizeInBrowser(file, field);

        if (controller.signal.aborted) return;

        patch(key, { status: "uploading" });

        const body = new FormData();
        body.set("field", field);
        body.set("file", optimized);

        const response = await fetch(endpoint, {
          method: "POST",
          body,
          signal: controller.signal,
        });

        /*
         * El cuerpo se lee siempre: la ruta manda el motivo también cuando
         * responde con error, y es el que hay que mostrar. Si ni siquiera es
         * JSON —un 502 de un proxy— queda el aviso genérico.
         */
        const result = (await response
          .json()
          .catch(() => null)) as UploadResponse | null;

        if (!result) {
          patch(key, { status: "error", error: UPLOAD_FAILED });
          return;
        }

        if (!result.ok) {
          patch(key, { status: "error", error: result.error });
          return;
        }

        patch(key, { status: "done", image: result.image, error: null });
      } catch (error) {
        // Abortada a propósito: el ítem ya no está, no hay nada que marcar.
        if (error instanceof DOMException && error.name === "AbortError") return;
        patch(key, { status: "error", error: UPLOAD_FAILED });
      } finally {
        controllers.current.delete(key);
      }
    },
    [endpoint, field, patch],
  );

  /**
   * Agrega archivos recién elegidos.
   *
   * Devuelve los avisos de los que no entraron, para que el campo los muestre
   * sin que un archivo rechazado impida subir los demás.
   */
  const add = useCallback(
    async (files: File[]): Promise<string[]> => {
      const rejected: string[] = [];
      if (initial.some(image => image.gallerySelectionPending)) return ["Confirmá y guardá la selección de galería antes de agregar imágenes."];

      // Las disponibles, incluidas ocultas y pendientes, ocupan cupo (BR-007).
      const existing = items.filter(
        (item) => item.status !== "error" && item.hiddenReason !== "plan",
      );
      const seen = new Set(
        existing.map((item) => (item.file ? fingerprint(item.file) : item.key)),
      );

      /*
       * Un campo de una sola imagen reemplaza en vez de acumular: elegir otra
       * foto de perfil es cambiar la que está.
       */
      const single = policy.maxCount === 1;
      let room = single ? 1 : limit === null ? Infinity : limit - existing.length;

      const accepted: { key: string; file: File; url: string }[] = [];

      for (const file of files) {
        if (room <= 0) {
          rejected.push(
            limit === 1
              ? "Sólo se admite una imagen en este campo."
              : `Podés subir hasta ${limit} ${limit === 1 ? "imagen" : "imágenes"}.`,
          );
          break;
        }

        if (seen.has(fingerprint(file))) {
          rejected.push(`"${file.name}" ya está agregada.`);
          continue;
        }

        const problem = await validateLocally(file, field);
        if (problem) {
          rejected.push(`"${file.name}": ${problem}`);
          continue;
        }

        seen.add(fingerprint(file));
        room -= 1;

        /*
         * La vista previa sale del archivo local y no de la URL servida:
         * evita el hueco entre elegir el archivo y que R2 empiece a responder
         * por esa clave.
         */
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);

        accepted.push({ key: nextKey(), file, url });
      }

      if (accepted.length === 0) return rejected;

      setItems((current) => {
        const incoming = accepted.map(({ key, file, url }) => ({
          key,
          status: "preparing" as const,
          previewUrl: url,
          image: null,
          error: null,
          file,
          // Lo que se sube ahora entra en el cupo: por eso se comprobó antes.
          active: true,
          hiddenReason: null,
        }));

        if (!single) return [...current.filter(item => item.active), ...incoming, ...current.filter(item => !item.active)];

        /*
         * Reemplazo en un campo de una sola: lo confirmado que había queda
         * anotado para quitarse al guardar, y lo pendiente que se descarta se
         * borra de verdad —nunca estuvo en ningún perfil—.
         */
        for (const item of current) {
          if (item.image?.lifecycle === "confirmed") {
            setRemovedIds((ids) =>
              ids.includes(item.image!.id) ? ids : [...ids, item.image!.id],
            );
          } else if (item.image) {
            void fetch(
              `${endpoint}${endpoint.includes("?") ? "&" : "?"}id=${encodeURIComponent(item.image.id)}`,
              { method: "DELETE" },
            ).catch(() => {
              // Si no se puede ahora, la levanta la limpieza al expirar.
            });
          }
          controllers.current.get(item.key)?.abort();
        }

        return incoming;
      });

      await Promise.all(accepted.map(({ key, file }) => send(key, file)));

      return rejected;
    },
    [endpoint, field, initial, items, limit, policy.maxCount, send],
  );

  /** Reintenta una que falló, sin tocar las demás. */
  const retry = useCallback(
    (key: string) => {
      const item = items.find((candidate) => candidate.key === key);
      if (!item?.file) return;
      void send(key, item.file);
    },
    [items, send],
  );

  /** Quita una imagen del campo. */
  const remove = useCallback(
    async (key: string) => {
      const item = items.find((candidate) => candidate.key === key);
      if (!item) return;

      // Todavía viajando: se corta antes de que llegue a existir.
      controllers.current.get(key)?.abort();

      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
        objectUrls.current.delete(item.previewUrl);
      }

      /*
       * Una confirmada no se borra: se anota para que el guardado la quite.
       * Cancelar la edición tiene que dejarla donde estaba (TR-043).
       */
      if (item.image?.lifecycle === "confirmed") {
        setRemovedIds((ids) =>
          ids.includes(item.image!.id) ? ids : [...ids, item.image!.id],
        );
        setItems((current) => current.filter((candidate) => candidate.key !== key));
        return;
      }

      // Una pendiente sí: nunca estuvo en ningún perfil.
      if (item.image) {
        patch(key, { status: "removing" });
        try {
          await fetch(
            `${endpoint}${endpoint.includes("?") ? "&" : "?"}id=${encodeURIComponent(item.image.id)}`,
            { method: "DELETE" },
          );
        } catch {
          // No se pudo ahora: expira sola y la levanta la limpieza.
        }
      }

      setItems((current) => current.filter((candidate) => candidate.key !== key));
    },
    [endpoint, items, patch],
  );

  /** Visibilidad voluntaria: no cambia disponibilidad ni cupo (BR-033). */
  const toggleActive = useCallback((key: string) => {
    setItems(current => {
      const item = current.find(candidate => candidate.key === key);
      if (!item || item.status !== "done" || item.hiddenReason === "plan") return current;
      const changed: UploadItem = { ...item, active: !item.active, hiddenReason: item.active ? "owner" : null };
      const rest = current.filter(candidate => candidate.key !== key);
      return changed.active
        ? [...rest.filter(candidate => candidate.active), changed, ...rest.filter(candidate => !candidate.active)]
        : [...rest, changed];
    });
  }, []);

  /** Mueve una imagen, para los campos que admiten ordenar. */
  const move = useCallback(
    (key: string, direction: -1 | 1) => {
      setItems((current) => {
        const index = current.findIndex((item) => item.key === key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.length) return current;

        const next = [...current];
        const moved = next[index];
        const displaced = next[target];
        if (!moved || !displaced || !moved.active || !displaced.active) return current;
        next[index] = displaced;
        next[target] = moved;
        return next;
      });
    },
    [],
  );

  /** true mientras algo esté procesándose: el guardado tiene que esperar. */
  const busy = items.some((item) => isBusy(item.status));

  /** Los ids que quedan, en orden. Es lo que el formulario manda al guardar. */
  const keepIds = items
    .filter((item) => item.status === "done" && item.image)
    .map((item) => item.image!.id);

  /**
   * Cuáles de esos quedan visibles (BR-033). El resto sigue
   * guardado e inactivo.
   */
  const activeIds = items
    .filter((item) => item.status === "done" && item.image && item.active)
    .map((item) => item.image!.id);

  /** Disponibles que ocupan cupo, aunque estén ocultas voluntariamente. */
  const activeCount = items.filter((item) => item.hiddenReason !== "plan" && item.status !== "error").length;

  return {
    items,
    busy,
    keepIds,
    activeIds,
    removedIds,
    /** Cuántas más entran. `null` es sin tope. */
    room: limit === null ? null : Math.max(0, limit - activeCount),
    /** Las que no se muestran porque no entran en el plan (BR-009). */
    overPlanCount: items.filter(
      (item) => item.hiddenReason === "plan",
    ).length,
    /** Las que el proveedor ocultó a propósito. Nunca se borran. */
    hiddenByOwnerCount: items.filter(
      (item) => !item.active && item.hiddenReason === "owner",
    ).length,
    add,
    retry,
    remove,
    move,
    toggleActive,
  };
}
