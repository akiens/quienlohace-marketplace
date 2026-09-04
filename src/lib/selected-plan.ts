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

/**
 * La cuenta que se quedó con el plan elegido, para no arrastrarlo a otra.
 *
 * El plan se elige en `/planes` sin sesión, así que no puede nacer a nombre
 * de nadie como el borrador. Se le pone dueño al entrar al alta; elegir uno
 * nuevo lo deja otra vez sin dueño, porque es de quien lo acaba de elegir.
 */
const OWNER_KEY = "qlh.selectedPlanOwner";

/** Las escrituras propias no disparan `storage`: se avisan con este evento. */
const LOCAL_EVENT = "qlh:selected-plan";

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
    /*
     * Elegir un plan lo deja sin dueño a propósito.
     *
     * La marca de dueño existe para no arrastrar el plan de una cuenta a
     * otra, y se pone al entrar al alta. Pero puede sobrevivir a quien la
     * dejó —alguien que se registra, llega al alta y la abandona sin crear
     * el perfil—, y entonces la elección de la persona siguiente aparecía
     * como "de otra cuenta" y se borraba: elegía Platino y el alta abría en
     * Cobre.
     *
     * Recién elegido, el plan es de quien lo está eligiendo ahora. Sin dueño,
     * el alta se lo adjudica a la cuenta que entre, que es la correcta.
     */
    window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Sin almacenamiento el flujo sigue: sólo se pierde la preselección.
  }
  // `storage` no se dispara en la pestaña que escribe: se avisa a mano.
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

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

    /*
     * Sin dueño el plan es de quien entra: o lo acaba de elegir —elegir
     * borra la marca— o no hay ninguno guardado. En los dos casos no hay
     * nada que descartar, sólo que adjudicar.
     */
    const stale = owner !== null;
    if (stale) window.localStorage.removeItem(KEY);

    window.localStorage.setItem(OWNER_KEY, ownerId);

    /*
     * Se avisa del cambio: `storage` sólo llega a las otras pestañas, y quien
     * está mostrando el plan en ésta necesita enterarse de que ya no está.
     */
    if (stale) window.dispatchEvent(new Event(LOCAL_EVENT));

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
