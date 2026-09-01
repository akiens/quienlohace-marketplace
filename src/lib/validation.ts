import { z } from "zod";

import { CATEGORIES } from "@/data/categories";
import { getLocation } from "@/data/locations";
import { toE164 } from "@/domain/phone";


/**
 * Schemas compartidos. La UI los usa para dar feedback inmediato, pero la
 * validación que cuenta es la del servidor: nunca se confía en el cliente
 * (RF-163).
 */

/**
 * Techo defensivo, por encima del plan más alto. El límite comercial real
 * lo aplica la acción según el plan del proveedor.
 */
const ABSOLUTE_MAX_ITEMS = 60;

const SUBCATEGORY_IDS = new Set(
  CATEGORIES.flatMap((category) =>
    category.subcategories.map((sub) => sub.id),
  ),
);

const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Otros",
] as const;

/** Un id de ubicación sólo es válido si existe en el Master Data. */
const locationId = z
  .string()
  .refine((id) => getLocation(id) !== undefined, "Ubicación desconocida.");

/**
 * Nombre de una persona: nombre, nombre compuesto, apellido paterno y
 * apellido materno.
 *
 * Sólo letras y espacios. Se aceptan acentos y ñ (`\p{L}` con el flag `u`,
 * más `\p{M}` para los acentos que llegan descompuestos desde algunos
 * teclados). Quedan fuera dígitos, signos y emoji.
 *
 * El tope es de 4 partes, pero las partículas de los apellidos compuestos
 * ("de", "del", "los", "la"…) no cuentan como parte propia: si contaran,
 * nombres reales del padrón como "María de los Ángeles Carrillo Rangel" o
 * "Felipe Espinosa de los Monteros Cedillo" quedarían rechazados. Son ~1%
 * de los nombres de personas en `seeds/providers.json`.
 */
const NAME_ALLOWED = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;

/** Partículas que acompañan a un apellido en vez de ser una parte aparte. */
const NAME_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "da",
  "das",
  "do",
  "dos",
  "van",
  "von",
  "di",
  "san",
  "santa",
]);

const MAX_NAME_PARTS = 4;

/** Partes reales del nombre: se descartan las partículas. */
function nameParts(value: string): string[] {
  return value
    .split(" ")
    .filter((word) => word.length > 0 && !NAME_PARTICLES.has(word.toLowerCase()));
}

export const nameSchema = z
  .string({ error: "Debe entrar un nombre." })
  .trim()
  .min(1, "Debe entrar un nombre.")
  .min(2, "El nombre entrado no es válido.")
  .max(80, "El nombre entrado es demasiado largo.")
  .refine(
    (value) => NAME_ALLOWED.test(value),
    "El nombre sólo puede tener letras y espacios.",
  )
  .refine(
    (value) => nameParts(value).length <= MAX_NAME_PARTS,
    "Escribí sólo tu nombre y tus apellidos.",
  );

/**
 * Contraseña. El único requisito de negocio es el mínimo de 8 caracteres.
 *
 * El máximo no es cosmético: bcrypt/scrypt trabajan sobre la entrada
 * completa, así que sin tope una contraseña enorme es trabajo de hash
 * gratis para quien la envía.
 */
export const passwordSchema = z
  .string({ error: "Debe entrar una contraseña." })
  .min(1, "Debe entrar una contraseña.")
  .min(8, "La contraseña no cumple con el mínimo de caracteres requeridos.")
  .max(200, "La contraseña es demasiado larga.");

export const emailSchema = z
  .string({ error: "Debe entrar un correo." })
  .trim()
  .toLowerCase()
  .min(1, "Debe entrar un correo.")
  .email("El correo entrado no es válido.")
  .max(254, "El correo entrado es demasiado largo.");

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Alta de cuenta: sólo correo y contraseña.
 *
 * El nombre se pide en la creación del perfil y no acá: en el registro es
 * fricción para un dato que todavía no se usa, y el perfil lo vuelve a pedir
 * igual. `nameSchema` sigue exportado porque lo usa ese formulario.
 */
export const signupSchema = credentialsSchema;

export const providerProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribí el nombre de tu perfil.")
      .max(80, "Máximo 80 caracteres."),
    kind: z.enum(["individual", "business"]),
    description: z
      .string()
      .trim()
      .min(20, "Contá en pocas líneas qué hacés (mínimo 20 caracteres).")
      .max(600, "Máximo 600 caracteres."),
    subcategoryId: z
      .string()
      .refine((id) => SUBCATEGORY_IDS.has(id), "Elegí una subcategoría válida."),
    locationId,
    /*
     * Un solo teléfono (RF-013). De acá se derivan el enlace `tel:` y el de
     * `wa.me`: se valida que sea un número marcable, no su formato exacto,
     * porque cada quien lo escribe a su manera y `toE164` lo normaliza.
     */
    phone: z
      .string()
      .trim()
      .min(1, "Dejá un teléfono para que puedan contactarte.")
      .max(40, "El teléfono es demasiado largo.")
      .refine(
        (value) => toE164(value) !== "",
        "El teléfono entrado no es válido.",
      ),
    whatsappEnabled: z.coerce.boolean().default(false),
    schedule: z.string().trim().max(160).default(""),
    // El tope real lo pone el plan contratado, que se comprueba en la acción
    // (RF-053). Acá sólo queda un techo defensivo, común a todos los planes,
    // para que un envío manipulado no llegue con miles de elementos.
    services: z
      .array(z.string().trim().min(1).max(60))
      .min(1, "Agregá al menos un servicio.")
      .max(ABSOLUTE_MAX_ITEMS, "Demasiados servicios."),
    serviceAreaIds: z
      .array(locationId)
      .min(1, "Elegí al menos una zona donde trabajás.")
      .max(ABSOLUTE_MAX_ITEMS, "Demasiadas zonas."),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  });

export const reviewSchema = z.object({
  rating: z.coerce
    .number("Elegí una puntuación.")
    .int()
    .min(1, "Elegí una puntuación.")
    .max(5),
  comment: z
    .string()
    .trim()
    .min(10, "Contá un poco más sobre tu experiencia.")
    // RF-180: un tope de longitud acota el texto masivo automatizado.
    .max(1000, "Máximo 1000 caracteres."),
  authorName: z.string().trim().min(2, "Escribí tu nombre.").max(60),
});

/** RF-154: motivos de reporte. El detalle es opcional. */
export const reviewReportSchema = z.object({
  reviewId: z.string().min(1),
  reason: z.enum(
    ["spam", "offensive", "false_info", "personal_info", "conflict", "other"],
    "Elegí un motivo.",
  ),
  detail: z.string().trim().max(500, "Máximo 500 caracteres.").default(""),
});

export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;

/** Convierte los errores de Zod al shape que usan los formularios. */
export function fieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
