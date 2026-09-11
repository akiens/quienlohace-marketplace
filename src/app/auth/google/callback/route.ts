import { cookies } from "next/headers";

import { D1ConsumerRepository } from "@/infrastructure/d1-consumer-repository";
import { createConsumerSession } from "@/lib/consumer-session";
import {
  OAUTH_STATE_COOKIE,
  decodeState,
  exchangeCodeForIdentity,
} from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/**
 * Vuelta desde Google.
 *
 * Se valida que el `state` coincida con la cookie: sin esa comprobación,
 * un tercero podría iniciar el flujo y dejar la sesión de otra cuenta.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const store = await cookies();

  const expectedNonce = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  const rawState = url.searchParams.get("state") ?? "";
  const { nonce, returnTo } = decodeState(rawState);
  const back = (params?: Record<string, string>) => {
    const target = new URL(returnTo, url.origin);
    for (const [key, value] of Object.entries(params ?? {})) {
      target.searchParams.set(key, value);
    }
    return Response.redirect(target, 302);
  };

  // El usuario canceló en la pantalla de Google: no es un error que valga
  // la pena mostrar, se vuelve a donde estaba.
  if (url.searchParams.get("error")) return back();

  const code = url.searchParams.get("code");
  if (!code || !expectedNonce || nonce !== expectedNonce) {
    return back({ auth: "error" });
  }

  const identity = await exchangeCodeForIdentity(code);
  if (!identity) return back({ auth: "error" });

  try {
    const consumer = await new D1ConsumerRepository().upsertFromGoogle(identity);
    if (consumer.status !== "active") return back({ auth: "suspended" });

    await createConsumerSession(consumer.id);
  } catch (error) {
    // No se registra el código OAuth ni la identidad. El mensaje del error
    // alcanza para diagnosticar contratos de D1 sin exponer credenciales.
    console.error(
      "Google OAuth persistence failed",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    );
    return back({ auth: "error" });
  }

  // `?opinar=1` reabre el formulario de opinión en el punto donde se quedó.
  return back({ opinar: "1" });
}
