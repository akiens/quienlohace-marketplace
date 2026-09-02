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

/**
 * Qué campos habilita cada plan, más allá de los topes numéricos.
 *
 * Los topes viven en la base (`plans`) porque cambian sin desplegar; esto es
 * distinto: es la forma del formulario, y define qué pasos se muestran.
 */
export type PlanFeature = "gallery" | "social" | "team" | "verification";

export function allowsFeature(plan: PlanLimits, feature: PlanFeature): boolean {
  switch (feature) {
    case "gallery":
      return plan.maxGalleryImages > 0;
    case "social":
      return plan.allowsSocialLinks;
    case "team":
      return plan.maxTeamMembers > 0;
    case "verification":
      return plan.allowsVerificationRequest;
  }
}

/** Orden de presentación y comparación: Cobre < Oro < Platino. */
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

/**
 * Paleta del banderín que lleva el nombre del plan.
 *
 * Son colores de metal (cobre, oro, platino) y no del sistema de marca: la
 * idea es que el banderín y la insignia se lean como la misma pieza. Por eso
 * viven acá junto a `PLAN_BADGES` y no en los tokens de Tailwind, que
 * describen la identidad de QuienLoHace.
 *
 * El degradado va de izquierda a derecha y arranca oscuro, para que el texto
 * blanco tenga contraste suficiente en los tres planes sin cambiar de color
 * según el metal. `fold` es el pliegue que cae por izquierda: más oscuro aún
 * que el arranque, porque representa la cara en sombra de la cinta.
 */
export type PlanRibbon = {
  /** Banderín de `/planes`, sobre la tarjeta blanca. */
  face: string;
  /** Pliegue del banderín: la cara en sombra de la cinta. */
  fold: string;
  /**
   * Color sólido del metal, para bordes sobre fondo claro.
   *
   * Los degradados de arriba están pensados para fondos oscuros; sobre la
   * tarjeta blanca del formulario se necesita un color plano y con cuerpo,
   * que se lea como borde y no como una sombra.
   */
  edge: string;
  /**
   * Fila del adelanto en `/entrar` y `/registro`, sobre el panel azul.
   *
   * Es otra rampa y no la misma de `face`: aquélla arranca casi negra para
   * sostener el texto blanco sobre una tarjeta clara, y sobre el panel azul
   * (#455D88 → #182D53) quedaría más oscura que el fondo, como un hueco. Acá
   * el metal entra con cuerpo por izquierda y se desvanece hacia la derecha,
   * que es donde va el precio.
   *
   * Termina en alfa 0 antes del borde (85%) y no en un resto de color: la
   * fila no lleva borde de ese lado, así que cualquier tinte remanente se
   * vería como un canto vertical en vez de un desvanecido.
   */
  row: string;
};

/**
 * Etiqueta de nivel que acompaña al nombre en el banderín de `/planes`.
 *
 * Resume en una palabra qué es cada plan, para que la comparación se entienda
 * antes de leer la lista de límites. No sale de la base porque no es un dato
 * configurable como el precio (RF-096): es la manera de nombrar los niveles.
 */
export const PLAN_TIERS: Record<PlanId, string> = {
  cobre: "Básico",
  gold: "Avanzado",
  platinum: "Completo",
};

export const PLAN_RIBBONS: Record<PlanId, PlanRibbon> = {
  cobre: {
    face: "linear-gradient(90deg,#4A2410 0%,#8A4E24 45%,#C87941 100%)",
    fold: "#31170A",
    edge: "#A65E2E",
    row: "linear-gradient(90deg,rgba(200,121,65,.55) 0%,rgba(200,121,65,.18) 55%,rgba(200,121,65,0) 85%)",
  },
  gold: {
    face: "linear-gradient(90deg,#5A3D0C 0%,#A2721B 45%,#E3B23C 100%)",
    fold: "#3C2707",
    edge: "#C8912A",
    row: "linear-gradient(90deg,rgba(227,178,60,.50) 0%,rgba(227,178,60,.16) 55%,rgba(227,178,60,0) 85%)",
  },
  platinum: {
    face: "linear-gradient(90deg,#2E3849 0%,#55637A 45%,#8E9AAE 100%)",
    fold: "#1E2530",
    edge: "#7C8AA0",
    row: "linear-gradient(90deg,rgba(190,205,228,.45) 0%,rgba(190,205,228,.14) 55%,rgba(190,205,228,0) 85%)",
  },
};
