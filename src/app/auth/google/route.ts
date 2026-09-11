import { cookies } from "next/headers";

import {
  OAUTH_STATE_COOKIE,
  authorizationUrl,
  encodeState,
  oauthStateCookieName,
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
  const provider = url.searchParams.get("account") === "provider";
  const purpose = provider
    ? url.searchParams.get("mode") === "link"
      ? "provider-link"
      : "provider-login"
    : "consumer";

  const nonce = crypto.randomUUID();
  const state = encodeState(nonce, returnTo, purpose);
  const target = authorizationUrl(state, nonce);

  if (!target) {
    // Sin credenciales configuradas no se puede iniciar sesión; se vuelve al
    // origen en vez de mostrar un error que el visitante no puede resolver.
    return Response.redirect(new URL(returnTo, url.origin), 302);
  }

  const store = await cookies();
  // Se guarda el state entero: así también quedan vinculados al nonce la
  // intención (cliente/proveedor) y el destino de vuelta.
  store.set(oauthStateCookieName(nonce), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // El intercambio dura segundos; 10 minutos es margen de sobra.
  });
  // Limpia la cookie global usada por versiones anteriores. Los intentos
  // nuevos quedan aislados por nonce y pueden convivir durante esos 10 min.
  store.delete(OAUTH_STATE_COOKIE);

  return Response.redirect(target, 302);
}
