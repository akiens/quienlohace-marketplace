"use server";

import { redirect } from "next/navigation";

import { D1UserRepository } from "@/infrastructure/d1-repositories";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { credentialsSchema, fieldErrors, signupSchema } from "@/lib/validation";

/**
 * Server Actions de autenticación. Corren sólo en el servidor: la validación
 * y la verificación de credenciales nunca dependen del cliente.
 */

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
};

const users = new D1UserRepository();

const EMAIL_TAKEN = "El correo entrado ya está en uso.";

/**
 * Mensaje para cuando el registro falla por algo que no es culpa de los
 * datos: la base no responde, el hash falla, etc. No se muestra el error
 * real, que no le dice nada a quien se registra y puede filtrar detalles
 * de la infraestructura.
 */
const SIGNUP_FAILED =
  "No fue posible el registro, por favor intente más tarde.";

/** true si el error viene del índice único de `users.email`. */
function isUniqueEmailViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNIQUE constraint failed") && message.includes("users.email")
  );
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  try {
    const existing = await users.findByEmail(parsed.data.email);
    if (existing) {
      return { errors: { email: EMAIL_TAKEN } };
    }
  } catch (error) {
    // La consulta también puede fallar si la base no responde.
    console.error("signup lookup failed", error);
    return { errors: { form: SIGNUP_FAILED } };
  }

  try {
    const user = await users.create({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    });
    await createSession(user.id);
  } catch (error) {
    // Entre el `findByEmail` de arriba y este INSERT puede colarse otro
    // registro con el mismo correo. El índice único de `users.email` es lo
    // que realmente lo impide; acá se traduce ese choque al mismo mensaje
    // que el camino normal, en vez de dejar salir un error de la base.
    if (isUniqueEmailViolation(error)) {
      return { errors: { email: EMAIL_TAKEN } };
    }

    // Cualquier otra falla (base caída, error al hashear) se registra para
    // poder diagnosticarla y se le devuelve a la persona un aviso genérico.
    console.error("signup failed", error);
    return { errors: { form: SIGNUP_FAILED } };
  }

  // Fuera del `try`: `redirect` corta el flujo lanzando una excepción y el
  // catch de arriba la tomaría por un fallo del registro.
  redirect("/dashboard");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const user = await users.findByEmail(parsed.data.email);
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);

  // Mismo mensaje para "no existe" y "contraseña incorrecta": no confirmamos
  // qué correos están registrados.
  if (!user || !valid) {
    return { errors: { form: "Correo o contraseña incorrectos." } };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
