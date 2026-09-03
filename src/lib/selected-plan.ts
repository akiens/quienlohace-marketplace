import { PLAN_IDS } from "@/domain/plans";
import type { PlanId } from "@/types";

/**
 * Plan elegido durante el alta, guardado en el navegador.
 *
 * Vivía en la URL (`?plan=`) y traía dos problemas: quedaba desactualizado
 * al cambiar de plan en el panel — volver atrás resucitaba el anterior — y
 * era editable a mano. Acá no se ve ni se comparte por enlace.
 *
 * No es un dato de confianza: el servidor decide qué plan corresponde y qué
 * datos entran (RF-163). Esto sólo recuerda la intención entre el registro y
 * la creación del perfil.
 */
const KEY = "qlh.selectedPlan";

/** Cualquier fallo al leer se trata como "no hay nada elegido". */
export function readSelectedPlan(): PlanId | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return PLAN_IDS.includes(stored as PlanId) ? (stored as PlanId) : null;
  } catch {
    // Ventana privada o almacenamiento bloqueado: se sigue sin recordar nada.
    return null;
  }
}

export function writeSelectedPlan(planId: PlanId): void {
  try {
    window.localStorage.setItem(KEY, planId);
  } catch {
    // Sin almacenamiento el flujo sigue: sólo se pierde la preselección.
  }
  // `storage` no se dispara en la pestaña que escribe: se avisa a mano.
  window.dispatchEvent(new Event("qlh:selected-plan"));
}

/**
 * La cuenta que dejó el plan elegido, para no arrastrarlo a otra.
 *
 * El plan se elige antes de existir la cuenta —en `/planes`, sin sesión—, así
 * que no puede quedar a nombre de nadie desde el principio como el borrador.
 * Lo que se anota es quién lo usó: cuando el alta se abre con otra cuenta, el
 * plan recordado es de la persona anterior y se descarta.
 */
const OWNER_KEY = "qlh.selectedPlanOwner";

/**
 * Deja el plan a nombre de una cuenta, o lo descarta si ya era de otra.
 *
 * Devuelve `true` si se descartó, para que quien llame sepa que el valor
 * cambió y vuelva a leerlo.
 */
export function claimSelectedPlan(ownerId: string): boolean {
  try {
    const owner = window.localStorage.getItem(OWNER_KEY);
    if (owner === ownerId) return false;

    // De otra cuenta: no es una preferencia de quien está entrando ahora.
    const stale = owner !== null;
    if (stale) window.localStorage.removeItem(KEY);

    window.localStorage.setItem(OWNER_KEY, ownerId);
    return stale;
  } catch {
    // Sin almacenamiento no hay nada arrastrado que limpiar.
    return false;
  }
}

/** Se limpia cuando el plan ya vive en el perfil y no hace falta recordarlo. */
export function clearSelectedPlan(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Nada que hacer: si no se puede borrar, la próxima lectura lo ignora.
  }
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * localStorage es un almacén externo a React: leerlo con `useState` +
 * `useEffect` provoca un render en cascada y desincroniza servidor y
 * cliente. `useSyncExternalStore` está hecho justamente para esto, y con
 * `getServerSnapshot` el servidor rinde el valor por defecto sin romper la
 * hidratación.
 *
 * `storage` sólo avisa de cambios hechos en otra pestaña, así que las
 * escrituras propias emiten además un evento local.
 */
const LOCAL_EVENT = "qlh:selected-plan";

export function subscribeSelectedPlan(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

/** El snapshot debe ser estable: se cachea para no devolver otro valor cada vez. */
export function selectedPlanSnapshot(): PlanId {
  return readSelectedPlan() ?? "cobre";
}

/** En el servidor no hay almacenamiento: siempre el plan por defecto. */
export function selectedPlanServerSnapshot(): PlanId {
  return "cobre";
}
