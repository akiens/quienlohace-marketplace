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
  signupSchema,
} from "../src/lib/validation";

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
      locations: [{ locationId: "montevideo", isPrimary: true }],
    }).success,
  );
  check(
    "BR-015 — el país no sirve como ubicación física",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [{ locationId: "uruguay", isPrimary: true }],
    }).success,
  );
  check(
    "BR-015 — sólo una ubicación principal",
    !profileSchema.safeParse({
      ...VALID_PROFILE,
      locations: [
        { locationId: "montevideo", isPrimary: true },
        { locationId: "canelones", isPrimary: true },
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
  check(
    "rechaza descripción demasiado corta",
    !profileSchema.safeParse({ ...VALID_PROFILE, description: "corta" }).success,
  );

  console.log(
    failures === 0
      ? "\nTodo en orden.\n"
      : `\n${failures} verificación(es) fallaron.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
