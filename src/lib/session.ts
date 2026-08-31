import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { D1SessionRepository, D1UserRepository } from "@/infrastructure/d1-repositories";
import type { User } from "@/types";

/**
 * Sesiones por cookie opaca.
 *
 * En la base se guarda únicamente el SHA-256 del token: si alguien lee la
 * tabla `sessions` no obtiene cookies utilizables.
 */

const COOKIE_NAME = "qlh_session";
const SESSION_DAYS = 30;

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(userId: string): Promise<void> {
  // 32 bytes de entropía: no es adivinable ni enumerable.
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await new D1SessionRepository().create({
    id: await hashToken(token),
    userId,
    expiresAt,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // Inaccesible desde JavaScript: mitiga robo por XSS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Permite volver desde un OAuth externo sin perder la sesión.
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await new D1SessionRepository().delete(await hashToken(token));
  }
  store.delete(COOKIE_NAME);
}

/**
 * Usuario de la petición actual, o null.
 * `cache()` evita repetir la consulta cuando varios componentes la piden
 * durante el mismo render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await new D1SessionRepository().findValid(
    await hashToken(token),
    new Date(),
  );
  if (!session) return null;

  return new D1UserRepository().findById(session.userId);
});

/**
 * Exige sesión. Lanza si no hay usuario: toda acción sensible debe llamarla
 * en el servidor. Ocultar un botón no es autorización.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
