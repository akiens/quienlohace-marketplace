import type { ServiceMode } from "@/types";

/**
 * Borrador del formulario de alta de perfil, guardado en el navegador.
 *
 * Completar el perfil lleva varios pasos y bastante escritura. Si se recarga
 * la página a mitad de camino —sin querer, o porque el navegador la descarta
 * por falta de memoria— perder todo obliga a empezar de nuevo, y es el
 * momento donde más gente abandona. Acá se recuerda lo cargado y en qué paso
 * se estaba, hasta que el perfil se guarda de verdad.
 *
 * Sólo aplica al alta: con perfil creado la fuente de verdad es la base, y un
 * borrador viejo la contradiría.
 *
 * No es un dato de confianza: el servidor valida igual todo lo que llega
 * (RF-163). Esto sólo evita volver a tipearlo.
 */
const KEY = "qlh.profileDraft";

/**
 * Sube cuando cambia la forma del borrador. Uno viejo se descarta en vez de
 * rehidratar campos que ya no existen o cambiaron de significado.
 */
const VERSION = 1;

/** Lo que se recuerda. Todo opcional: un borrador es, por definición, parcial. */
export type ProfileDraft = {
  version: number;
  /** El paso donde estaba, para volver ahí y no al principio. */
  step?: string;
  name?: string;
  kind?: string;
  description?: string;
  subcategoryId?: string;
  subcategoryIds?: string[];
  services?: string[];
  locationId?: string;
  serviceMode?: ServiceMode;
  serviceAreaIds?: string[];
  phone?: string;
  whatsappEnabled?: boolean;
  schedule?: string;
  paymentMethods?: string[];
  socialLinks?: Record<string, string>;
  teamMembers?: Array<{
    name?: string;
    role?: string;
    subtitle?: string;
    bio?: string;
  }>;
};

/**
 * Lee el borrador. Cualquier problema —almacenamiento bloqueado, JSON roto,
 * versión vieja— se trata como "no hay borrador": es preferible un formulario
 * vacío que uno a medio rehidratar.
 */
export function readProfileDraft(): ProfileDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const draft = parsed as ProfileDraft;
    if (draft.version !== VERSION) return null;

    return draft;
  } catch {
    return null;
  }
}

/** Si el borrador no tiene nada que valga la pena recordar. */
function isEmpty(draft: Omit<ProfileDraft, "version">): boolean {
  return (
    !draft.name?.trim() &&
    !draft.description?.trim() &&
    !draft.subcategoryId &&
    !draft.locationId &&
    !draft.phone?.trim() &&
    !draft.schedule?.trim() &&
    !draft.services?.length &&
    !draft.subcategoryIds?.length &&
    !draft.serviceAreaIds?.length &&
    !draft.paymentMethods?.length &&
    !draft.teamMembers?.length &&
    !Object.keys(draft.socialLinks ?? {}).length
  );
}

/**
 * Guarda el borrador.
 *
 * Un borrador vacío nunca pisa a uno con datos: el formulario guarda en cada
 * cambio, y si al montarse llegara a escribir antes de tomar lo que había
 * guardado, borraría justo lo que venía a rescatar. Vacío sólo se escribe si
 * no había nada, que es el caso de empezar de cero.
 */
export function writeProfileDraft(draft: Omit<ProfileDraft, "version">): void {
  try {
    if (isEmpty(draft) && window.localStorage.getItem(KEY)) return;

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...draft, version: VERSION }),
    );
  } catch {
    // Ventana privada, almacenamiento lleno o bloqueado: se sigue sin
    // recordar. El formulario funciona igual, sólo no sobrevive una recarga.
  }
}

/** Se borra al guardar el perfil: desde ahí manda la base. */
export function clearProfileDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Si no se puede borrar, la próxima lectura igual lo descarta al
    // encontrarse con que ya hay perfil creado.
  }
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * El borrador vive en `localStorage`, que en el servidor no existe. Leerlo
 * directo en el estado inicial deja el HTML del servidor (siempre vacío) y el
 * primer render del cliente (ya con el borrador) diciendo cosas distintas, y
 * React aborta la hidratación.
 *
 * Con `useSyncExternalStore` el primer render usa el snapshot del servidor
 * —vacío, igual que el HTML— y recién después toma el del cliente. La
 * hidratación calza y el borrador entra en el render siguiente, sin remontar
 * el formulario.
 */
export function subscribeProfileDraft(onChange: () => void): () => void {
  // Sólo cambia desde esta misma pestaña, y quien lo cambia ya re-renderiza
  // por su propio estado. Alcanza con escuchar a las otras.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * El snapshot tiene que ser estable: `useSyncExternalStore` compara por
 * identidad y un objeto nuevo en cada llamada haría un bucle de renders. Se
 * cachea el texto crudo y se reusa el objeto mientras no cambie.
 */
let cachedRaw: string | null = null;
let cachedDraft: ProfileDraft | null = null;

export function profileDraftSnapshot(): ProfileDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = readProfileDraft();
  }
  return cachedDraft;
}

/** En el servidor no hay borrador: el HTML sale igual que un formulario nuevo. */
export function profileDraftServerSnapshot(): ProfileDraft | null {
  return null;
}
