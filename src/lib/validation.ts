import { z } from "zod";

import { getLocation, locationExists } from "@/data/locations";
import {
  MAX_SCHEDULE_ENTRIES,
  MAX_SCHEDULE_LENGTH,
  MIN_SCHEDULE_LENGTH,
} from "@/data/schedules";
import { specialtyExists } from "@/data/taxonomy";
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

/** Una especialidad sólo es válida si existe en el catálogo (BR-011). */
const specialtyId = z
  .string()
  .refine(specialtyExists, "Elegí una especialidad válida.");

/** Las redes que acepta el esquema de la base. */
const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "website",
] as const;

/** Los códigos que persiste la base (TR-001). */
const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "debit_card",
  "credit_card",
  "other",
] as const;

/** BR-017: las tres modalidades. "Híbrida" se deriva de elegir varias. */
const SERVICE_MODES = ["at_customer", "at_business", "remote"] as const;

/** Un id de ubicación sólo es válido si existe en el catálogo (BR-014). */
const locationId = z.string().refine(locationExists, "Ubicación desconocida.");

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
 * Alta de cuenta: correo, contraseña y su repetición.
 *
 * El nombre se pide en la creación del perfil y no acá: en el registro es
 * fricción para un dato que todavía no se usa, y el perfil lo vuelve a pedir
 * igual. `nameSchema` sigue exportado porque lo usa ese formulario.
 *
 * La repetición se compara en los dos lados (`docs/ui/register_form.md`). El
 * error se cuelga de `passwordConfirm` y no del formulario entero: es ese
 * campo el que hay que corregir, y así el mensaje aparece debajo de él.
 */
export const signupSchema = credentialsSchema
  .extend({
    passwordConfirm: z
      .string({ error: "Debe repetir la contraseña." })
      .min(1, "Debe repetir la contraseña."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirm"],
  });

/**
 * Horario en texto libre (BR-024, TR-005).
 *
 * No admite teléfonos, correos, URLs ni HTML: el horario es cuándo se atiende,
 * y colar ahí un contacto sortea las reglas de BR-004 sobre qué canal es
 * público.
 */
const scheduleEntrySchema = z
  .string()
  .trim()
  .min(MIN_SCHEDULE_LENGTH, `Mínimo ${MIN_SCHEDULE_LENGTH} caracteres.`)
  .max(MAX_SCHEDULE_LENGTH, `Máximo ${MAX_SCHEDULE_LENGTH} caracteres.`)
  .refine((value) => !/<[^>]*>/.test(value), "No se admiten etiquetas HTML.")
  .refine(
    (value) => !/https?:\/\/|www\./i.test(value),
    "No se admiten direcciones web en el horario.",
  )
  .refine(
    (value) => !/[\w.+-]+@[\w-]+\.[\w.]+/.test(value),
    "No se admiten correos en el horario.",
  )
  .refine(
    // Siete dígitos o más seguidos, con separadores, es un teléfono.
    (value) => !/(?:\d[\s.-]?){7,}/.test(value),
    "No se admiten teléfonos en el horario.",
  );

export const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribí el nombre de tu perfil.")
      .max(80, "Máximo 80 caracteres."),
    type: z.enum(["individual", "business"]),
    description: z
      .string()
      .trim()
      .min(20, "Contá en pocas líneas qué hacés (mínimo 20 caracteres).")
      .max(600, "Máximo 600 caracteres."),
    icon: z.string().trim().max(60).default("work"),

    /*
     * BR-004: el correo de contacto puede ser distinto del de acceso. Es
     * opcional acá porque alcanza con tener un canal público, y el teléfono
     * puede ser ése; que quede al menos uno lo comprueba el refine de abajo.
     */
    contactEmail: z.union([emailSchema, z.literal("")]).default(""),

    /*
     * Un solo teléfono (BR-004). De acá se derivan el enlace `tel:` y el de
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
    phonePublic: z.coerce.boolean().default(true),

    /*
     * Las especialidades elegidas del catálogo. Los rubros no se piden: se
     * derivan de ellas (BR-010). El tope real lo pone el plan y se comprueba
     * en la acción; acá sólo queda un techo defensivo.
     */
    specialtyIds: z
      .array(specialtyId)
      .min(1, "Elegí al menos una especialidad.")
      .max(ABSOLUTE_MAX_ITEMS, "Demasiadas especialidades."),

    /*
     * Cada servicio dice a qué especialidad pertenece: la base lo exige con
     * una FK compuesta, así que mandarlo suelto no alcanzaría (BR-010).
     */
    services: z
      .array(
        z.object({
          specialtyId,
          name: z
            .string()
            .trim()
            .min(3, "El servicio necesita al menos 3 caracteres.")
            .max(80, "Máximo 80 caracteres."),
        }),
      )
      .max(ABSOLUTE_MAX_ITEMS, "Demasiados servicios.")
      .default([]),

    // BR-017: una o varias. "Híbrida" no se elige, se deriva.
    serviceModes: z
      .array(z.enum(SERVICE_MODES))
      .min(1, "Elegí al menos una forma de prestar el servicio."),

    serviceAreaIds: z
      .array(locationId)
      .min(1, "Elegí al menos una zona donde trabajás.")
      .max(ABSOLUTE_MAX_ITEMS, "Demasiadas zonas."),

    /*
     * BR-015: el local, que es una dirección concreta.
     *
     * Tiene que ser una localidad: ni el país ni un departamento entero dicen
     * dónde atiende alguien, y con "todo Canelones" nadie puede llegar. Antes
     * sólo se rechazaba el país, así que un departamento pasaba.
     *
     * La dirección dejó de ser opcional por lo mismo: una localidad sola
     * ubica el pueblo, no la puerta.
     */
    locations: z
      .array(
        z.object({
          locationId: locationId.refine(
            (id) => getLocation(id)?.type === "locality",
            "Elegí la localidad de tu local.",
          ),
          name: z.string().trim().max(80).nullable().default(null),
          address: z
            .string()
            .trim()
            .min(1, "Escribí la dirección de tu local.")
            .max(160),
          isPrimary: z.coerce.boolean().default(false),
        }),
      )
      .max(ABSOLUTE_MAX_ITEMS, "Demasiadas ubicaciones.")
      .default([]),

    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),

    scheduleEntries: z
      .array(scheduleEntrySchema)
      .max(MAX_SCHEDULE_ENTRIES, `Hasta ${MAX_SCHEDULE_ENTRIES} horarios.`)
      .default([]),

    /* Redes sociales (BR-022). Sólo con plan que las habilite. */
    socialLinks: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS),
          url: z
            .string()
            .trim()
            .url("Poné una dirección completa, con https://")
            .max(300, "La dirección es demasiado larga."),
        }),
      )
      .max(SOCIAL_PLATFORMS.length, "Demasiadas redes.")
      .default([]),
  })
  .refine(
    // BR-010: un servicio no puede colgar de una especialidad no elegida.
    (data) =>
      data.services.every((service) =>
        data.specialtyIds.includes(service.specialtyId),
      ),
    {
      message: "Hay servicios de una especialidad que no seleccionaste.",
      path: ["services"],
    },
  )
  .refine(
    // BR-011: no se repite un servicio dentro de la misma especialidad.
    (data) => {
      const seen = new Set<string>();
      for (const service of data.services) {
        const key = `${service.specialtyId}|${service.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    { message: "Hay servicios repetidos.", path: ["services"] },
  )
  .refine(
    // BR-015: si se atiende en el negocio, hace falta un local.
    (data) =>
      !data.serviceModes.includes("at_business") || data.locations.length > 0,
    {
      message: "Agregá la dirección de tu local para atender ahí.",
      path: ["locations"],
    },
  )
  .refine((data) => data.locations.filter((l) => l.isPrimary).length <= 1, {
    message: "Sólo una ubicación puede ser la principal.",
    path: ["locations"],
  })
  .refine(
    // BR-004: al menos un canal de contacto público.
    (data) => data.contactEmail !== "" || data.phonePublic,
    {
      message: "Dejá un correo de contacto o hacé público tu teléfono.",
      path: ["contactEmail"],
    },
  );

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

export type ProfileInput = z.infer<typeof profileSchema>;

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
