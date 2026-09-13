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

/**
 * Texto que se muestra como texto: nunca debe contener etiquetas HTML ni
 * controles invisibles. Se permiten saltos de línea y tabulaciones en campos
 * multilínea; los campos de una sola línea los rechazan también.
 */
const UNSAFE_PLAIN_TEXT = /<[^>]*>|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const UNSAFE_SINGLE_LINE_TEXT = /<[^>]*>|[\u0000-\u001F\u007F]/u;
const isSafePlainText = (value: string) => !UNSAFE_PLAIN_TEXT.test(value);
const isSafeSingleLineText = (value: string) =>
  !UNSAFE_SINGLE_LINE_TEXT.test(value);
const SAFE_TEXT_MESSAGE =
  "No se admiten etiquetas HTML ni caracteres de control.";

/** Una especialidad sólo es válida si existe en el catálogo (BR-011). */
const specialtyId = z
  .string()
  .refine(specialtyExists, "Elegí una especialidad válida.");

/** Las redes que acepta el esquema de la base. */
export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "website",
] as const;

type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const SOCIAL_DOMAINS: Record<Exclude<SocialPlatform, "website">, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com", "lnkd.in"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
};

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  website: "el sitio web",
};

/**
 * Una dirección social completa y correspondiente a la plataforma elegida.
 *
 * Se compara el hostname ya interpretado por `URL`, no texto parcial: así
 * `instagram.com.ejemplo.com` no puede pasar por una dirección de Instagram.
 * Los subdominios oficiales sí son válidos (`www`, `m`, `vm`, etc.).
 */
export const socialLinkSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    url: z
      .string()
      .trim()
      .min(1, "Escribí la dirección.")
      .max(300, "La dirección es demasiado larga."),
  })
  .superRefine((link, context) => {
    let parsed: URL;
    try {
      parsed = new URL(link.url);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Poné una dirección completa, con https://",
      });
      return;
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== ""
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Poné una dirección segura que empiece con https://",
      });
      return;
    }

    if (link.platform === "website") return;

    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const domains = SOCIAL_DOMAINS[link.platform];
    const belongsToPlatform = domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );

    if (!belongsToPlatform) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: `La dirección debe pertenecer a ${SOCIAL_LABELS[link.platform]}.`,
      });
      return;
    }

    if (parsed.pathname === "/" || parsed.pathname === "") {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: `Poné el enlace a tu perfil o contenido de ${SOCIAL_LABELS[link.platform]}.`,
      });
    }
  });

const socialLinksSchema = z
  .array(
    z.object({
      platform: z.enum(SOCIAL_PLATFORMS),
      url: z.string().trim(),
    }),
  )
  .max(SOCIAL_PLATFORMS.length, "Demasiadas redes.")
  .superRefine((links, context) => {
    const seen = new Set<SocialPlatform>();

    links.forEach((link) => {
      if (seen.has(link.platform)) {
        context.addIssue({
          code: "custom",
          path: [link.platform],
          message: `Sólo podés agregar una dirección de ${SOCIAL_LABELS[link.platform]}.`,
        });
        return;
      }
      seen.add(link.platform);

      const parsed = socialLinkSchema.safeParse(link);
      if (parsed.success) return;
      context.addIssue({
        code: "custom",
        path: [link.platform],
        message: parsed.error.issues[0]?.message ?? "Dirección no válida.",
      });
    });
  });

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

/**
 * Qué caracteres admite el nombre de un perfil.
 *
 * No es `nameSchema`: aquél es el nombre de una persona —sólo letras, hasta
 * cuatro partes— y un perfil puede llamarse "Herrería Téllez S.R.L.",
 * "Fletes 24/7" o "Pinturas Díaz & Hijos". Así que se permiten letras con sus
 * tildes, números y la puntuación que aparece de verdad en un nombre
 * comercial: punto, coma, guion, apóstrofo, & / y paréntesis.
 *
 * Lo que queda afuera es lo que no nombra nada y sí sirve para colar cosas:
 * `<` `>` para etiquetas HTML, `\` `|` `{}` `[]` `$` `` ` `` para inyecciones y
 * plantillas, y `@` que hace pasar un nombre por un correo o un usuario. No es
 * la defensa —eso es escapar la salida y consultas con parámetros— pero evita
 * guardar basura que nadie escribió de buena fe.
 *
 * Tiene que empezar con letra o número: un nombre que arranca con puntuación
 * es casi siempre un intento de ordenar la lista a la fuerza.
 */
/**
 * Qué caracteres admite un teléfono escrito a mano.
 *
 * Dígitos y los signos con los que se escribe un número acá: el `+` del código
 * de país (sólo al principio), espacios, guiones, puntos y paréntesis. Sin
 * letras: `toE164` las descartaría en silencio y guardaría como válido algo
 * que no lo es.
 */
const PHONE_ALLOWED = /^\+?[\d .\-()]+$/;

const PROFILE_NAME_ALLOWED =
  /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,\-'’&/()]*$/u;

/**
 * Un servicio es un nombre visible, no una porción de HTML, una consulta ni
 * una expresión. Acepta la puntuación que se usa en nombres reales (por
 * ejemplo, "Pintura interior/exterior" o "Service 24/7") y rechaza símbolos
 * de marcado, plantillas y sentencias.
 *
 * Esta allowlist mejora la calidad del dato. La defensa contra SQL injection
 * sigue siendo usar parámetros al persistir; validar texto nunca la sustituye.
 */
const SERVICE_NAME_ALLOWED = PROFILE_NAME_ALLOWED;

export const serviceNameSchema = z
  .string({ error: "Escribí un servicio." })
  .trim()
  .transform((value) => value.replace(/ {2,}/g, " "))
  .pipe(
    z
      .string()
      .min(3, "El servicio necesita al menos 3 caracteres.")
      .max(80, "Máximo 80 caracteres.")
      .refine(
        (value) => SERVICE_NAME_ALLOWED.test(value),
        "Usá sólo letras, números y . , - ' & / ( )",
      ),
  );

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
export const scheduleEntrySchema = z
  .string()
  .trim()
  .min(MIN_SCHEDULE_LENGTH, `Mínimo ${MIN_SCHEDULE_LENGTH} caracteres.`)
  .max(MAX_SCHEDULE_LENGTH, `Máximo ${MAX_SCHEDULE_LENGTH} caracteres.`)
  .refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE)
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
      .max(80, "Máximo 80 caracteres.")
      .refine(
        (value) => PROFILE_NAME_ALLOWED.test(value),
        "El nombre sólo puede tener letras, números y . , - ' & / ( )",
      ),
    type: z.enum(["individual", "business"]),
    description: z
      .string()
      .trim()
      .min(20, "Contá en pocas líneas qué hacés (mínimo 20 caracteres).")
      .max(600, "Máximo 600 caracteres.")
      .refine(isSafePlainText, SAFE_TEXT_MESSAGE),
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
      /*
       * Primero la forma y después el contenido.
       *
       * `toE164` se queda con los dígitos y descarta todo lo demás, así que
       * por sí solo aceptaba "abc099123456xyz" y guardaba un número válido
       * sacado de una cadena que nadie escribiría como teléfono. Se comprueba
       * antes que lo escrito parezca un teléfono: dígitos y los signos con los
       * que se los escribe acá —espacio, guion, punto, paréntesis y el + del
       * código de país—.
       */
      .refine(
        (value) => PHONE_ALLOWED.test(value),
        "El teléfono sólo puede tener números, espacios y + - ( ) .",
      )
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
          name: serviceNameSchema,
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
          name: z
            .string()
            .trim()
            .max(80)
            .refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE)
            .nullable()
            .default(null),
          address: z
            .string()
            .trim()
            .min(1, "Escribí la dirección de tu local.")
            .max(160)
            .refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE),
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
    socialLinks: socialLinksSchema.default([]),
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

/**
 * Formulario de contacto (TR-039).
 *
 * Reusa `nameSchema` y `emailSchema` en vez de repetir la regla: sin esto el
 * formulario traía su propio regex de correo, más permisivo que el del resto
 * del sitio, y un correo que acá pasaba podía no pasar en el registro.
 */
export const CONTACT_REASONS = [
  "consulta",
  "perfil",
  "publicidad",
  "reporte",
] as const;

export const contactSchema = z.object({
  nombre: nameSchema,
  email: emailSchema,
  motivo: z.enum(CONTACT_REASONS, { error: "Elegí un motivo." }),
  mensaje: z
    .string({ error: "Escribí tu mensaje." })
    .trim()
    .min(10, "Contanos un poco más (al menos 10 caracteres).")
    .max(2000, "El mensaje es demasiado largo.")
    .refine(isSafePlainText, SAFE_TEXT_MESSAGE),
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
    .max(1000, "Máximo 1000 caracteres.")
    .refine(isSafePlainText, SAFE_TEXT_MESSAGE),
  authorName: z
    .string()
    .trim()
    .min(2, "Escribí tu nombre.")
    .max(60)
    .refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE),
});

/** Datos editables de una carta de servicio. Los importes llegan en pesos. */
export const serviceCardSchema = z
  .object({
    serviceId: z.string().trim().min(1, "Elegí uno de los servicios de tu perfil."),
    title: z.string().trim().min(3, "Escribí un nombre de al menos 3 caracteres.").max(90, "Máximo 90 caracteres.").refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE),
    description: z.string().trim().min(20, "Contá qué incluye el servicio (mínimo 20 caracteres).").max(800, "Máximo 800 caracteres.").refine(isSafePlainText, SAFE_TEXT_MESSAGE),
    priceKind: z.enum(["quote", "fixed", "from", "range"]),
    priceMin: z.coerce.number().nonnegative("El precio no puede ser negativo.").nullable(),
    priceMax: z.coerce.number().nonnegative("El precio no puede ser negativo.").nullable(),
    tier: z.enum(["economy", "standard", "premium"]),
    durationMinMinutes: z.coerce.number().int().positive().nullable(),
    durationMaxMinutes: z.coerce.number().int().positive().nullable(),
    serviceMode: z.enum(SERVICE_MODES),
    paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
    schedule: z.string().trim().max(160, "Máximo 160 caracteres.").refine(isSafeSingleLineText, SAFE_TEXT_MESSAGE),
    imageId: z.string().trim().nullable(),
    isPublished: z.boolean(),
  })
  .superRefine((card, context) => {
    if (card.priceKind !== "quote" && card.priceMin === null) {
      context.addIssue({ code: "custom", path: ["priceMin"], message: "Ingresá el precio." });
    }
    if (card.priceKind === "range" && card.priceMax === null) {
      context.addIssue({ code: "custom", path: ["priceMax"], message: "Ingresá el precio máximo." });
    }
    if (card.priceMin !== null && card.priceMax !== null && card.priceMax < card.priceMin) {
      context.addIssue({ code: "custom", path: ["priceMax"], message: "Debe ser igual o mayor al precio mínimo." });
    }
    if (card.durationMinMinutes !== null && card.durationMaxMinutes !== null && card.durationMaxMinutes < card.durationMinMinutes) {
      context.addIssue({ code: "custom", path: ["durationMaxMinutes"], message: "Debe ser igual o mayor a la duración mínima." });
    }
  });

/** Crear o cambiar la contraseña desde una sesión profesional autenticada. */
export const passwordUpdateSchema = z
  .object({
    currentPassword: z
      .string()
      .max(200, "La contraseña actual es demasiado larga.")
      .optional()
      .default(""),
    newPassword: passwordSchema,
    passwordConfirm: z
      .string({ error: "Debe repetir la contraseña nueva." })
      .min(1, "Debe repetir la contraseña nueva."),
  })
  .refine((data) => data.newPassword === data.passwordConfirm, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirm"],
  });

/** Reglas de la carta por campo, compartidas con el editor del navegador. */
export const serviceCardFieldSchemas: Record<string, z.ZodTypeAny> =
  serviceCardSchema.shape;

/** RF-154: motivos de reporte. El detalle es opcional. */
export const reviewReportSchema = z.object({
  reviewId: z.string().min(1),
  reason: z.enum(
    ["spam", "offensive", "false_info", "personal_info", "conflict", "other"],
    "Elegí un motivo.",
  ),
  detail: z.string().trim().max(500, "Máximo 500 caracteres.").refine(isSafePlainText, SAFE_TEXT_MESSAGE).default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Las reglas de `profileSchema`, campo por campo, para validar en el cliente.
 *
 * Se sacan del propio schema con `.shape` en lugar de escribirlas de nuevo:
 * son la misma regla, y copiarlas garantiza que algún día digan cosas
 * distintas —el cliente aceptando lo que el servidor rechaza, o al revés—.
 *
 * Sólo sirve para los campos sueltos que se escriben a mano. Las reglas que
 * cruzan campos (que haya un canal de contacto, que atender en el local exija
 * una dirección) viven en los `refine` del schema entero y las comprueba el
 * servidor: no se pueden evaluar mirando un campo solo.
 */
export const profileFieldSchemas: Record<string, z.ZodTypeAny> =
  profileSchema.shape;

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
