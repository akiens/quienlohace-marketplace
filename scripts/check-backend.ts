/**
 * Verifica la lógica de backend que no depende del runtime de Workers:
 * hashing de contraseñas y schemas de validación.
 *
 * Las consultas a D1 se prueban con la base local (ver README).
 * Se ejecuta con: npm run check:backend
 */
import { hashPassword, verifyPassword } from "../src/lib/password";
import {
  credentialsSchema,
  providerProfileSchema,
  signupSchema,
} from "../src/lib/validation";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const VALID_PROFILE = {
  name: "Juan Electricidad",
  kind: "individual" as const,
  description: "Electricista matriculado con más de 12 años de oficio en Montevideo.",
  subcategoryId: "hogar-y-mantenimiento-electricidad",
  locationId: "montevideo-montevideo-pocitos",
  phone: "099 123 456",
  whatsapp: "59899123456",
  schedule: "Lunes a sábado",
  services: ["Instalaciones eléctricas"],
  serviceAreaIds: ["montevideo-montevideo-pocitos"],
  paymentMethods: ["Efectivo" as const],
};

async function main() {
  console.log("\nContraseñas");
  const hash = await hashPassword("una-clave-segura");
  check("el hash no contiene la contraseña", !hash.includes("una-clave-segura"));
  check("verifica la correcta", await verifyPassword("una-clave-segura", hash));
  check("rechaza la incorrecta", !(await verifyPassword("otra-clave", hash)));
  check("rechaza hash nulo", !(await verifyPassword("x", null)));
  check("rechaza hash corrupto", !(await verifyPassword("x", "basura")));
  const second = await hashPassword("una-clave-segura");
  check("dos hashes de la misma clave difieren (salt)", hash !== second);

  console.log("\nValidación de credenciales");
  check(
    "rechaza contraseña corta",
    !credentialsSchema.safeParse({ email: "a@b.com", password: "corta" }).success,
  );
  check(
    "rechaza correo inválido",
    !credentialsSchema.safeParse({ email: "no-es-mail", password: "12345678" }).success,
  );
  check(
    "normaliza el correo a minúsculas",
    credentialsSchema.safeParse({ email: "  A@B.COM ", password: "12345678" })
      .data?.email === "a@b.com",
  );
  check(
    "exige nombre al registrarse",
    !signupSchema.safeParse({ email: "a@b.com", password: "12345678", name: "" }).success,
  );

  console.log("\nValidación del perfil");
  check("acepta un perfil completo", providerProfileSchema.safeParse(VALID_PROFILE).success);
  check(
    "rechaza subcategoría inexistente",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, subcategoryId: "no-existe" }).success,
  );
  check(
    "rechaza ubicación inexistente",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, locationId: "narnia-centro" }).success,
  );
  check(
    "rechaza zona de servicio inexistente",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, serviceAreaIds: ["narnia"] }).success,
  );
  check(
    "exige al menos un servicio",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, services: [] }).success,
  );
  check(
    "limita las zonas a 5",
    !providerProfileSchema.safeParse({
      ...VALID_PROFILE,
      serviceAreaIds: [
        "montevideo-montevideo-pocitos", "montevideo-montevideo-buceo",
        "montevideo-montevideo-centro", "montevideo-montevideo-malvin",
        "montevideo-montevideo-cordon", "montevideo-montevideo-prado",
      ],
    }).success,
  );
  check(
    "exige al menos una vía de contacto",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, phone: "", whatsapp: "" }).success,
  );
  check(
    "acepta sólo teléfono, sin WhatsApp",
    providerProfileSchema.safeParse({ ...VALID_PROFILE, whatsapp: "" }).success,
  );
  check(
    "rechaza WhatsApp con letras",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, whatsapp: "099-abc" }).success,
  );
  check(
    "rechaza descripción demasiado corta",
    !providerProfileSchema.safeParse({ ...VALID_PROFILE, description: "corta" }).success,
  );

  console.log(
    failures === 0 ? "\nTodo en orden.\n" : `\n${failures} verificacion(es) fallaron.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
