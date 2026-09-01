import { cookies } from "next/headers";

import {
  OAUTH_STATE_COOKIE,
  authorizationUrl,
  encodeState,
  safeReturnTo,
} from "@/lib/google-oauth";

/** Nunca se cachea: cada inicio necesita su propio valor anti-CSRF. */
export const dynamic = "force-dynamic";

/**
 * Inicio del login con Google (RF-123).
 *
 * `returnTo` viaja dentro del `state` firmado por la cookie, para volver al
 * perfil desde donde se pidió opinar (RF-129).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo") ?? "/");

  const nonce = crypto.randomUUID();
  const target = authorizationUrl(encodeState(nonce, returnTo));

  if (!target) {
    // Sin credenciales configuradas no se puede iniciar sesión; se vuelve al
    // origen en vez de mostrar un error que el visitante no puede resolver.
    return Response.redirect(new URL(returnTo, url.origin), 302);
  }

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // El intercambio dura segundos; 10 minutos es margen de sobra.
  });

  return Response.redirect(target, 302);
}
