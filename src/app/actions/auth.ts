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

  const existing = await users.findByEmail(parsed.data.email);
  if (existing) {
    return { errors: { email: "Ya existe una cuenta con ese correo." } };
  }

  const user = await users.create({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
  });

  await createSession(user.id);
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
