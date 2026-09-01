import type { PlanId, PlanLimits } from "@/types";

/**
 * Reglas de negocio de los planes (RF-050 a RF-053).
 *
 * Los valores vienen de la base (`plans`), no de acá: RF-096 pide poder
 * cambiar precios y límites sin desplegar. Este módulo sólo contiene la
 * lógica que se aplica sobre esos valores, para que el servidor y la UI
 * decidan igual y no se contradigan.
 */

/** Qué campo del perfil consume qué límite. */
export type LimitedField =
  | "services"
  | "subcategories"
  | "serviceAreas"
  | "galleryImages"
  | "teamMembers";

/** Sólo las claves numéricas: así el índice no puede apuntar a un booleano. */
type NumericLimitKey = {
  [K in keyof PlanLimits]: PlanLimits[K] extends number ? K : never;
}[keyof PlanLimits];

const LIMIT_KEYS: Record<LimitedField, NumericLimitKey> = {
  services: "maxServices",
  subcategories: "maxSubcategories",
  serviceAreas: "maxServiceAreas",
  galleryImages: "maxGalleryImages",
  teamMembers: "maxTeamMembers",
};

export function limitFor(plan: PlanLimits, field: LimitedField): number {
  return plan[LIMIT_KEYS[field]];
}

/**
 * Recorta una lista al límite del plan.
 *
 * RF-053: al bajar de plan no se borra información. Se conserva lo que entra
 * y se informa cuánto queda fuera, para que el proveedor elija qué publicar
 * en vez de perderlo en silencio.
 */
export function applyLimit<T>(
  items: T[],
  plan: PlanLimits,
  field: LimitedField,
): { kept: T[]; excess: T[]; limit: number } {
  const limit = limitFor(plan, field);
  return {
    kept: items.slice(0, limit),
    excess: items.slice(limit),
    limit,
  };
}

/** true si agregar un elemento más superaría el plan contratado. */
export function isAtLimit(
  current: number,
  plan: PlanLimits,
  field: LimitedField,
): boolean {
  return current >= limitFor(plan, field);
}

/**
 * Mensaje de error cuando una lista excede el plan. Se usa igual en el
 * servidor (validación) y en la UI (aviso), así el proveedor lee lo mismo
 * en los dos lados.
 */
export function limitMessage(
  plan: PlanLimits,
  field: LimitedField,
  label: string,
): string {
  const limit = limitFor(plan, field);
  if (limit === 0) {
    return `Tu plan ${plan.name} no incluye ${label}.`;
  }
  return `Tu plan ${plan.name} permite hasta ${limit} ${label}.`;
}

/**
 * Precio legible: los importes se guardan en centavos.
 *
 * Toma sólo el importe y no un `PlanLimits` entero para que también sirva
 * donde se muestra un adelanto del plan sin sus límites.
 */
export function formatPrice(plan: Pick<PlanLimits, "priceCents">): string {
  if (plan.priceCents === 0) return "Gratis";
  const amount = plan.priceCents / 100;
  const shown = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `USD ${shown}/mes`;
}

/** Orden de presentación y comparación: Cobre < Gold < Platinum. */
export function isUpgrade(from: PlanLimits, to: PlanLimits): boolean {
  return to.rank > from.rank;
}

export const PLAN_IDS: PlanId[] = ["cobre", "gold", "platinum"];

/**
 * Insignia de cada plan. Vive acá y no en un componente porque la usan tanto
 * `/planes` como el adelanto del panel de acceso, y una sola copia evita que
 * un plan quede con la imagen de otro.
 *
 * El archivo es la insignia dibujada (COBRE/ORO/PLATINO); el nombre visible
 * sigue saliendo de la base, que es la que manda (RF-096).
 */
export const PLAN_BADGES: Record<PlanId, string> = {
  cobre: "/brand/plans/cobre.png",
  gold: "/brand/plans/oro.png",
  platinum: "/brand/plans/platino.png",
};
