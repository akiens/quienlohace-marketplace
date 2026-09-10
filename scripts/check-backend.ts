/**
 * Verifica la lógica de backend que no depende del runtime de Workers:
 * hashing de contraseñas y schemas de validación.
 *
 * El esquema, el seed y las reglas sobre los datos se verifican aparte, contra
 * una base real: `npm run check:data`.
 *
 * Se ejecuta con: npm run check:backend
 */
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  credentialsSchema,
  profileSchema,
  serviceCardSchema,
  signupSchema,
  socialLinkSchema,
} from "../src/lib/validation";
import { interpretSearchQuery } from "../src/lib/search-intent";
import { softlyDiversify } from "../src/lib/search-ranking";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Un perfil que cumple todo, del que parten las variantes inválidas. */
const VALID_PROFILE = {
  name: "Juan Electricidad",
  type: "individual" as const,
  description:
    "Electricista matriculado con más de 12 años de oficio en Montevideo.",
  contactEmail: "juan@ejemplo.uy",
  phone: "099 123 456",
  specialtyIds: ["hogar-y-mantenimiento-electricidad"],
  services: [
    {
      specialtyId: "hogar-y-mantenimiento-electricidad",
      name: "Instalación eléctrica",
    },
  ],
  serviceModes: ["at_customer" as const],
  serviceAreaIds: ["montevideo"],
  paymentMethods: ["cash" as const],
};

async function main(): Promise<void> {
  console.log("\nBúsqueda y discovery");
  const longQuery = interpretSearchQuery(
    "Necesito alguien que venga a casa porque el aire acondicionado prende pero no enfría",
  );
  check(
    "interpreta una frase larga como reparación de aire acondicionado",
    longQuery.phrases.some((phrase) => phrase.includes("reparacion de aire acondicionado")),
  );
  check("detecta atención a domicilio sin convertirla en filtro", longQuery.inferredMode === "at_customer");
  const occupation = interpretSearchQuery("electricista");
  check(
    "un oficio puede recuperar su especialidad",
    occupation.allowSpecialtyMatch &&
      occupation.specialtyIds.includes("hogar-y-mantenimiento-electricidad"),
  );
  const specific = interpretSearchQuery("instalar aire acondicionado");
  check(
    "una actividad concreta no autoriza toda la especialidad",
    !specific.allowSpecialtyMatch,
  );
  check(
    "sugiere corrección conservadora para un error breve",
    interpretSearchQuery("plomreo").suggestedQuery === "plomero",
  );
  check(
    "conserva la exclusión que sigue a una negación",
    interpretSearchQuery("quiero reparar no comprar").exclusions.includes("comprar"),
  );
  const diversified = softlyDiversify(
    [
      { id: "a-1", provider: "a", score: 100 },
      { id: "a-2", provider: "a", score: 98 },
      { id: "b-1", provider: "b", score: 96 },
      { id: "c-1", provider: "c", score: 60 },
    ],
    (item) => item.provider,
    (item) => item.score,
  );
  check(
    "diversifica cartas cercanas sin eliminar ninguna",
    diversified.map((item) => item.id).join(",") === "a-1,b-1,a-2,c-1",
  );
  check(
    "no adelanta una carta claramente menos relevante",
    softlyDiversify(
      [
        { id: "a-1", provider: "a", score: 100 },
        { id: "a-2", provider: "a", score: 96 },
        { id: "b-1", provider: "b", score: 70 },
      ],
      (item) => item.provider,
      (item) => item.score,
    ).map((item) => item.id).join(",") === "a-1,a-2,b-1",
  );

  console.log("\nContraseñas (TR-007)");
  const hash = await hashPassword("una-clave-segura");
  check("el hash no contiene la contraseña", !hash.includes("una-clave-segura"));
  check("verifica la correcta", await verifyPassword("una-clave-segura", hash));
  check("rechaza la incorrecta", !(await verifyPassword("otra-clave", hash)));
  check("rechaza hash nulo", !(await verifyPassword("x", null)));
  check("rechaza hash corrupto", !(await verifyPassword("x", "basura")));
  const second = await hashPassword("una-clave-segura");
  check("dos hashes de la misma clave difieren (salt)", hash !== second);

  console.log("\nCredenciales");
  check(
    "rechaza contraseña corta",
    !credentialsSchema.safeParse({ email: "a@b.com", password: "corta" })
      .success,
  );
  check(
    "rechaza correo inválido",
    !credentialsSchema.safeParse({ email: "no-es-mail", password: "12345678" })
      .success,
  );
  check(
    "normaliza el correo a minúsculas",
    credentialsSchema.safeParse({ email: "  A@B.COM ", password: "12345678" })
      .data?.email === "a@b.com",
  );

  console.log("\nRegistro (docs/ui/register_form.md)");
  const signupOk = {
    email: "a@b.com",
    password: "12345678",
    passwordConfirm: "12345678",
  };
  check("acepta correo y contraseñas iguales", signupSchema.safeParse(signupOk).success);
  check(
    "rechaza contraseñas distintas",
    !signupSchema.safeParse({ ...signupOk, passwordConfirm: "87654321" })
      .success,
  );
  check(
    "exige repetir la contraseña",
    !signupSchema.safeParse({ email: "a@b.com", password: "12345678" }).success,
  );
  check(
    "rechaza contraseña de menos de 8 caracteres",
    !signupSchema.safeParse({
      email: "a@b.com",
      password: "1234567",
      passwordConfirm: "1234567",
    }).success,
  );

  console.log("\nPerfil (BR-003 a BR-024)");
  check("acepta un perfil completo", profileSchema.safeParse(VALID_PROFILE).success);
  check(
    "BR-011 — rechaza especialidad inexistente",
    !profileSchema.safeParse({ ...VALID_PROFILE, specialtyIds: ["no-existe"] })
      .success,
  );
  check(
    "BR-014 — rechaza ubicación inexistente",
    !profileSchema.safeParse({ ...VALID_PROFILE, serviceAreaIds: ["narnia"] })
      .success,
  );
  check(
    "BR-016 — exige al menos una zona",
    !profileSchema.safeParse({ ...VALID_PROFILE, serviceAreaIds: [] }).success,
  );
  check(
    "BR-017 — exige al menos una modalidad",
    !profileSchema.safeParse({ ...VALID_PROFILE, serviceModes: [] }).success,
  );
  check(
    "BR-010 — rechaza un servicio de una especialidad no elegida",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      services: [{ specialtyId: "salud-medicina", name: "Pediatría" }],
    }).success,
  );
  check(
    "BR-011 — rechaza servicios repetidos en la misma especialidad",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      services: [
        { specialtyId: VALID_PROFILE.specialtyIds[0]!, name: "Instalación" },
        { specialtyId: VALID_PROFILE.specialtyIds[0]!, name: "INSTALACIÓN" },
      ],
    }).success,
  );
  check(
    "BR-015 — atender en el negocio exige un local",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      serviceModes: ["at_business"],
    }).success,
  );
  check(
    "BR-015 — acepta atención en el negocio con local",
    profileSchema.safeParse({
      ...VALID_PROFILE,
      serviceModes: ["at_business"],
      locations: [
        {
          locationId: "montevideo-montevideo",
          address: "18 de Julio 1234",
          isPrimary: true,
        },
      ],
    }).success,
  );
  check(
    "BR-015 — el país no sirve como ubicación física",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [
        { locationId: "uruguay", address: "18 de Julio 1234", isPrimary: true },
      ],
    }).success,
  );
  check(
    "BR-015 — un departamento entero no es una ubicación física",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [
        {
          locationId: "montevideo",
          address: "18 de Julio 1234",
          isPrimary: true,
        },
      ],
    }).success,
  );
  check(
    "BR-015 — el local exige dirección",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [{ locationId: "montevideo-montevideo", isPrimary: true }],
    }).success,
  );
  check(
    "BR-015 — sólo una ubicación principal",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [
        {
          locationId: "montevideo-montevideo",
          address: "18 de Julio 1234",
          isPrimary: true,
        },
        {
          locationId: "canelones-las-piedras",
          address: "Artigas 500",
          isPrimary: true,
        },
      ],
    }).success,
  );
  check(
    "BR-004 — exige al menos un canal de contacto público",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      contactEmail: "",
      phonePublic: false,
    }).success,
  );
  check(
    "BR-004 — acepta sólo el teléfono público",
    profileSchema.safeParse({ ...VALID_PROFILE, contactEmail: "" }).success,
  );
  check(
    "BR-004 — rechaza un teléfono que no es marcable",
    !profileSchema.safeParse({ ...VALID_PROFILE, phone: "abc" }).success,
  );
  check(
    "BR-024 — rechaza un horario con teléfono",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      scheduleEntries: ["Llamar al 099 123 456"],
    }).success,
  );
  check(
    "BR-024 — rechaza un horario con URL",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      scheduleEntries: ["Ver https://ejemplo.uy"],
    }).success,
  );
  check(
    "BR-024 — rechaza un horario con HTML",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      scheduleEntries: ["<b>Lunes</b> a viernes"],
    }).success,
  );
  check(
    "BR-024 — acepta horarios válidos",
    profileSchema.safeParse({
      ...VALID_PROFILE,
      scheduleEntries: ["Lunes a viernes de 08:00 a 17:00", "Domingos: cerrado"],
    }).success,
  );
  check(
    "BR-024 — no admite más de 10 horarios",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      scheduleEntries: Array.from(
        { length: 11 },
        () => "Lunes a viernes de 08:00 a 17:00",
      ),
    }).success,
  );
  /*
   * El nombre y el teléfono llegan escritos a mano y son los que más se
   * prestan a que entre cualquier cosa: el nombre sólo se medía de largo, y el
   * teléfono se validaba después de descartar todo lo que no fuera dígito, así
   * que "abc099123456xyz" pasaba y se guardaba como un número válido.
   */
  check(
    "rechaza un nombre de perfil con caracteres que no nombran nada",
    !profileSchema.safeParse({ ...VALID_PROFILE, name: "a@b|c\d" }).success,
  );
  check(
    "rechaza un nombre de perfil con HTML",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      name: "<script>alert(1)</script>",
    }).success,
  );
  check(
    "acepta un nombre comercial con puntuación legítima",
    profileSchema.safeParse({
      ...VALID_PROFILE,
      name: "Pinturas Díaz & Hijos S.R.L.",
    }).success,
  );
  check(
    "rechaza un teléfono con letras",
    !profileSchema.safeParse({ ...VALID_PROFILE, phone: "abc099123456xyz" })
      .success,
  );
  check(
    "acepta un teléfono escrito con espacios y signos",
    profileSchema.safeParse({ ...VALID_PROFILE, phone: "+598 99 123 456" })
      .success,
  );
  check(
    "rechaza descripción demasiado corta",
    !profileSchema.safeParse({ ...VALID_PROFILE, description: "corta" }).success,
  );

  console.log("\nCartas de servicio (BR-034)");
  const validCard = {
    specialtyId: "hogar-y-mantenimiento-electricidad",
    title: "Instalación de luminarias",
    description: "Incluye colocación, conexión y prueba final de las luminarias.",
    priceKind: "range" as const,
    priceMin: 1200,
    priceMax: 2500,
    tier: "standard" as const,
    durationMinMinutes: 60,
    durationMaxMinutes: 120,
    serviceMode: "at_customer" as const,
    paymentMethod: "bank_transfer" as const,
    schedule: "Coordinando con 48 horas",
    imageId: null,
    isPublished: true,
  };
  check("acepta una propuesta completa", serviceCardSchema.safeParse(validCard).success);
  check("un rango exige precio máximo", !serviceCardSchema.safeParse({ ...validCard, priceMax: null }).success);
  check("el precio máximo no puede ser menor", !serviceCardSchema.safeParse({ ...validCard, priceMax: 500 }).success);
  check("la duración máxima no puede ser menor", !serviceCardSchema.safeParse({ ...validCard, durationMaxMinutes: 30 }).success);
  check("acepta precio a convenir", serviceCardSchema.safeParse({ ...validCard, priceKind: "quote", priceMin: null, priceMax: null }).success);

  console.log("\nRedes sociales (BR-022, TR-039)");
  const socialCases = [
    ["instagram", "https://www.instagram.com/quienlohace"],
    ["facebook", "https://facebook.com/quienlohace"],
    ["linkedin", "https://uy.linkedin.com/company/quienlohace"],
    ["x", "https://x.com/quienlohace"],
    ["x", "https://twitter.com/quienlohace"],
    ["tiktok", "https://www.tiktok.com/@quienlohace"],
    ["youtube", "https://youtube.com/@quienlohace"],
    ["youtube", "https://youtu.be/abc123"],
    ["website", "https://quienlohace.uy"],
  ] as const;
  for (const [platform, url] of socialCases) {
    check(
      `acepta ${platform}: ${url}`,
      socialLinkSchema.safeParse({ platform, url }).success,
    );
  }
  check(
    "rechaza una URL de Facebook cargada como Instagram",
    !socialLinkSchema.safeParse({
      platform: "instagram",
      url: "https://facebook.com/quienlohace",
    }).success,
  );
  check(
    "rechaza dominios parecidos que no pertenecen a la red",
    !socialLinkSchema.safeParse({
      platform: "instagram",
      url: "https://instagram.com.ejemplo.com/quienlohace",
    }).success,
  );
  check(
    "rechaza HTTP",
    !socialLinkSchema.safeParse({
      platform: "youtube",
      url: "http://youtube.com/@quienlohace",
    }).success,
  );
  check(
    "rechaza la portada de una red sin perfil ni contenido",
    !socialLinkSchema.safeParse({
      platform: "linkedin",
      url: "https://linkedin.com/",
    }).success,
  );
  const wrongSocial = profileSchema.safeParse({
    ...VALID_PROFILE,
    socialLinks: [
      { platform: "instagram", url: "https://facebook.com/quienlohace" },
    ],
  });
  check(
    "el servidor atribuye el error a la plataforma",
    !wrongSocial.success &&
      wrongSocial.error.issues[0]?.path.join(".") === "socialLinks.instagram",
  );

  console.log(
    failures === 0
      ? "\nTodo en orden.\n"
      : `\n${failures} verificación(es) fallaron.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
