import "server-only";

import {
  getAppUrl,
  getGoogleOAuthCredentials,
} from "@/infrastructure/cloudflare";
import type { GoogleIdentity } from "@/types";

/**
 * Autenticación con Google para clientes y cuentas profesionales (RF-123).
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
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
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
export function authorizationUrl(state: string, nonce: string): string | null {
  const config = googleConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    // Sólo se necesita identificar a la persona: sin acceso offline no hay
    // refresh token que guardar ni que proteger.
    prompt: "select_account",
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleAuthPurpose =
  | "consumer"
  | "provider-login"
  | "provider-link";

/** Empaqueta el valor anti-CSRF, la intención y el destino en `state`. */
export function encodeState(
  nonce: string,
  returnTo: string,
  purpose: GoogleAuthPurpose = "consumer",
): string {
  return `${nonce}:${purpose}:${encodeURIComponent(returnTo)}`;
}

export function decodeState(state: string): {
  nonce: string;
  purpose: GoogleAuthPurpose;
  returnTo: string;
} {
  const firstSeparator = state.indexOf(":");
  const secondSeparator = state.indexOf(":", firstSeparator + 1);
  if (firstSeparator === -1 || secondSeparator === -1) {
    return { nonce: "", purpose: "consumer", returnTo: "/" };
  }

  const rawPurpose = state.slice(firstSeparator + 1, secondSeparator);
  const purpose: GoogleAuthPurpose =
    rawPurpose === "provider-login" || rawPurpose === "provider-link"
      ? rawPurpose
      : "consumer";

  let returnTo = "/";
  try {
    returnTo = safeReturnTo(
      decodeURIComponent(state.slice(secondSeparator + 1)),
    );
  } catch {
    // Un state malformado nunca decide un destino de navegación.
  }

  return {
    nonce: state.slice(0, firstSeparator),
    purpose,
    returnTo,
  };
}

/**
 * Sólo se acepta volver a una ruta interna: un `returnTo` absoluto podría
 * usarse para redirigir a otro sitio después de iniciar sesión.
 */
export function safeReturnTo(value: string): string {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/";
  }
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
  nonce?: string;
  email_verified?: boolean;
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
  expectedNonce: string,
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

  if (!response.ok) {
    // El status y el identificador normalizado alcanzan para diagnosticar sin
    // registrar el código, el token ni el cuerpo completo de la respuesta.
    let reason = "unknown";
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string") reason = payload.error;
    } catch {
      // El status HTTP sigue permitiendo diagnosticar una respuesta no JSON.
    }
    console.error("Google OAuth token exchange failed", response.status, reason);
    return null;
  }

  const token = (await response.json()) as TokenResponse;
  if (!token.id_token) return null;

  const claims = decodeJwtPayload(token.id_token);
  if (!claims?.sub || !claims.email || claims.email_verified !== true) {
    console.error("Google OAuth ID token validation failed", "identity");
    return null;
  }

  const issuerOk =
    claims.iss === "https://accounts.google.com" ||
    claims.iss === "accounts.google.com";
  if (!issuerOk) {
    console.error("Google OAuth ID token validation failed", "issuer");
    return null;
  }
  if (claims.aud !== config.clientId) {
    console.error("Google OAuth ID token validation failed", "audience");
    return null;
  }
  if (!claims.exp || claims.exp * 1000 < Date.now()) {
    console.error("Google OAuth ID token validation failed", "expiration");
    return null;
  }
  if (!expectedNonce || claims.nonce !== expectedNonce) {
    console.error("Google OAuth ID token validation failed", "nonce");
    return null;
  }

  return {
    providerUserId: claims.sub,
    email: claims.email,
    displayName: claims.name ?? claims.email.split("@")[0] ?? "Usuario",
    avatarUrl: claims.picture ?? "",
  };
}
