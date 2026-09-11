import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  D1ConsumerRepository,
  D1ConsumerSessionRepository,
} from "@/infrastructure/d1-consumer-repository";
import { getCurrentUser } from "@/lib/session";
import type { ConsumerUser } from "@/types";

/**
 * Sesión del cliente que deja opiniones.
 *
 * Conserva su propia cookie porque las opiniones y el perfil profesional
 * tienen ciclos de vida distintos. Cuando ambos registros están vinculados,
 * cualquiera de las sesiones puede recuperar la misma identidad de autor.
 * En la base sólo se guarda el SHA-256 del token.
 */

const COOKIE_NAME = "qlh_consumer";
const SESSION_DAYS = 90;

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createConsumerSession(consumerId: string): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await new D1ConsumerSessionRepository().create({
    id: await hashToken(token),
    userId: consumerId,
    expiresAt,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Permite volver desde Google sin perder la sesión.
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyConsumerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await new D1ConsumerSessionRepository().delete(await hashToken(token));
  }
  store.delete(COOKIE_NAME);
}

/**
 * Cliente de la petición actual, o null. Nunca lanza: la mayoría de las
 * páginas son públicas y no deben romperse porque no haya sesión (RF-121).
 */
export const getCurrentConsumer = cache(
  async (): Promise<ConsumerUser | null> => {
    // Una sesión profesional vinculada también demuestra quién es el autor
    // de sus opiniones. Esto mantiene acceso a opiniones anteriores incluso
    // si la cookie histórica de cliente expiró o fue creada en otro equipo.
    const currentUser = await getCurrentUser();
    if (currentUser?.role === "provider") {
      const linkedConsumer = await new D1ConsumerRepository().findByUserId(
        currentUser.id,
      );
      if (linkedConsumer?.status === "active") return linkedConsumer;
    }

    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await new D1ConsumerSessionRepository().findValid(
      await hashToken(token),
      new Date(),
    );
    if (!session) return null;

    const consumer = await new D1ConsumerRepository().findById(session.userId);
    // Una cuenta suspendida no puede seguir participando (RF-180).
    return consumer?.status === "active" ? consumer : null;
  },
);

export async function requireConsumer(): Promise<ConsumerUser> {
  const consumer = await getCurrentConsumer();
  if (!consumer) throw new Error("UNAUTHORIZED");
  return consumer;
}
