import { cookies } from "next/headers";

import {
  OAUTH_PENDING_COOKIE,
  OAUTH_STATE_COOKIE,
  authorizationUrl,
  decodePendingOAuthStates,
  encodePendingOAuthStates,
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
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  // Una lista breve bajo un único nombre evita tanto la colisión entre
  // pestañas como las diferencias de serialización observadas en cookies con
  // nombres dinámicos sobre OpenNext/Workers.
  const pendingStates = [
    ...decodePendingOAuthStates(store.get(OAUTH_PENDING_COOKIE)?.value),
    ...decodePendingOAuthStates(store.get(OAUTH_STATE_COOKIE)?.value),
  ].filter((pending) => pending !== state);
  pendingStates.push(state);
  store.set(
    OAUTH_PENDING_COOKIE,
    encodePendingOAuthStates(pendingStates),
    cookieOptions,
  );
  // Limpia la cookie estable usada por las dos implementaciones anteriores.
  store.delete(OAUTH_STATE_COOKIE);

  return Response.redirect(target, 302);
}
