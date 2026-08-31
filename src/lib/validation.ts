import { z } from "zod";

import { CATEGORIES } from "@/data/categories";
import { getLocation } from "@/data/locations";
import { MAX_LOCATIONS } from "@/types";

/**
 * Schemas compartidos. La UI los usa para dar feedback inmediato, pero la
 * validación que cuenta es la del servidor: nunca se confía en el cliente
 * (RF-163).
 */

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

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el correo."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const signupSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Escribí tu nombre.").max(80),
});

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
    phone: z.string().trim().max(40).default(""),
    // Sólo dígitos: es lo que espera el enlace wa.me.
    whatsapp: z
      .string()
      .trim()
      .regex(/^[0-9]*$/, "Usá sólo números, con código de país.")
      .max(20)
      .default(""),
    schedule: z.string().trim().max(160).default(""),
    services: z
      .array(z.string().trim().min(1).max(60))
      .min(1, "Agregá al menos un servicio.")
      .max(12, "Máximo 12 servicios."),
    serviceAreaIds: z
      .array(locationId)
      .min(1, "Elegí al menos una zona donde trabajás.")
      .max(MAX_LOCATIONS, `Máximo ${MAX_LOCATIONS} zonas.`),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  })
  // Sin al menos una vía de contacto el perfil no cumple su función.
  .refine((value) => value.phone.length > 0 || value.whatsapp.length > 0, {
    message: "Dejá al menos un teléfono o WhatsApp para que puedan contactarte.",
    path: ["whatsapp"],
  });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(10, "Contá un poco más sobre tu experiencia.")
    .max(1000, "Máximo 1000 caracteres."),
  authorName: z.string().trim().min(2, "Escribí tu nombre.").max(60),
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
