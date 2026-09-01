import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  D1ConsumerRepository,
  D1ConsumerSessionRepository,
} from "@/infrastructure/d1-consumer-repository";
import type { ConsumerUser } from "@/types";

/**
 * Sesión del cliente que deja opiniones.
 *
 * Es independiente de la sesión de proveedor: son dos identidades distintas
 * (RF-037) y una persona podría tener ambas. Misma mecánica que la de
 * proveedor: cookie opaca y en la base sólo el SHA-256 del token.
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
