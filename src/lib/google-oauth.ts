import "server-only";

import { getAppUrl } from "@/infrastructure/cloudflare";
import type { GoogleIdentity } from "@/infrastructure/d1-consumer-repository";

/**
 * Autenticación con Google para clientes (RF-123).
 *
 * Se implementa a mano en vez de con una librería porque el flujo que hace
 * falta es mínimo —un solo proveedor, sin refresh tokens— y las librerías
 * habituales asumen APIs de Node que en Workers no existen.
 *
 * Las credenciales se leen del entorno; sin ellas el botón de Google no se
 * muestra y el resto del sitio sigue funcionando (RF-142).
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const OAUTH_STATE_COOKIE = "qlh_oauth_state";

type GoogleConfig = { clientId: string; clientSecret: string };

/** Config de Google, o null si no está configurada. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleEnabled(): boolean {
  return googleConfig() !== null;
}

export function redirectUri(): string {
  return `${getAppUrl()}/auth/google/callback`;
}

/**
 * URL a la que se manda al usuario.
 *
 * `state` lleva el destino de vuelta además del valor anti-CSRF: RF-129 pide
 * volver exactamente a donde se estaba, y así no hace falta otra cookie.
 */
export function authorizationUrl(state: string): string | null {
  const config = googleConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Sólo se necesita identificar a la persona: sin acceso offline no hay
    // refresh token que guardar ni que proteger.
    prompt: "select_account",
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Empaqueta el valor anti-CSRF y el destino en un único `state`. */
export function encodeState(nonce: string, returnTo: string): string {
  return `${nonce}:${encodeURIComponent(returnTo)}`;
}

export function decodeState(state: string): {
  nonce: string;
  returnTo: string;
} {
  const separator = state.indexOf(":");
  if (separator === -1) return { nonce: state, returnTo: "/" };
  return {
    nonce: state.slice(0, separator),
    returnTo: safeReturnTo(decodeURIComponent(state.slice(separator + 1))),
  };
}

/**
 * Sólo se acepta volver a una ruta interna: un `returnTo` absoluto podría
 * usarse para redirigir a otro sitio después de iniciar sesión.
 */
export function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

type TokenResponse = { id_token?: string };

type GoogleClaims = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  exp?: number;
};

/** Decodifica el payload de un JWT. No valida la firma. */
function decodeJwtPayload(token: string): GoogleClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = (parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(json) as GoogleClaims;
  } catch {
    return null;
  }
}

/**
 * Canjea el `code` por la identidad de la persona.
 *
 * El `id_token` llega por HTTPS directo desde Google a cambio del client
 * secret, así que no hace falta verificar la firma acá: no pasó por el
 * navegador. Igual se comprueban emisor, destinatario y expiración, que es
 * lo que distingue un token propio de uno de otra aplicación.
 */
export async function exchangeCodeForIdentity(
  code: string,
): Promise<GoogleIdentity | null> {
  const config = googleConfig();
  if (!config) return null;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) return null;

  const token = (await response.json()) as TokenResponse;
  if (!token.id_token) return null;

  const claims = decodeJwtPayload(token.id_token);
  if (!claims?.sub || !claims.email) return null;

  const issuerOk =
    claims.iss === "https://accounts.google.com" ||
    claims.iss === "accounts.google.com";
  if (!issuerOk || claims.aud !== config.clientId) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;

  return {
    providerUserId: claims.sub,
    email: claims.email,
    displayName: claims.name ?? claims.email.split("@")[0] ?? "Usuario",
    avatarUrl: claims.picture ?? "",
  };
}
