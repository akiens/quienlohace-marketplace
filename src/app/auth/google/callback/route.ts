import { cookies } from "next/headers";

import { D1ConsumerRepository } from "@/infrastructure/d1-consumer-repository";
import {
  D1UserRepository,
  GoogleIdentityConflictError,
} from "@/infrastructure/d1-repositories";
import { createConsumerSession } from "@/lib/consumer-session";
import {
  OAUTH_STATE_COOKIE,
  decodeState,
  exchangeCodeForIdentity,
} from "@/lib/google-oauth";
import { createSession, getCurrentUser } from "@/lib/session";

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

  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  const rawState = url.searchParams.get("state") ?? "";
  const stateIsValid = Boolean(expectedState && rawState === expectedState);
  const { nonce, purpose, returnTo } = decodeState(
    stateIsValid ? rawState : (expectedState ?? ""),
  );
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
  if (!code || !stateIsValid || !nonce) {
    return back({ auth: "error" });
  }

  const identity = await exchangeCodeForIdentity(code, nonce);
  if (!identity) return back({ auth: "error" });

  if (purpose === "provider-login" || purpose === "provider-link") {
    try {
      const users = new D1UserRepository();
      const user =
        purpose === "provider-link"
          ? await linkCurrentProvider(users, identity)
          : await users.signInWithGoogle(identity);

      if (!user.isActive) return back({ auth: "suspended" });
      if (purpose === "provider-login") await createSession(user.id);

      // Si antes había opinado con esta misma identidad de Google, también
      // restaura esa faceta. Así puede editar sus opiniones anteriores sin
      // volver a autenticarse ni se crean autores duplicados.
      const consumer = await new D1ConsumerRepository().findByUserId(user.id);
      if (consumer?.status === "active") {
        try {
          await createConsumerSession(consumer.id);
        } catch (error) {
          // La sesión profesional ya es suficiente para recuperar la faceta
          // vinculada; una falla de esta cookie auxiliar no bloquea el login.
          console.error(
            "Linked consumer session creation failed",
            error instanceof Error ? error.message : "unknown",
          );
        }
      }

      return back(purpose === "provider-link" ? { auth: "google-linked" } : undefined);
    } catch (error) {
      console.error(
        "Provider Google OAuth failed",
        error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
      );
      return back({
        auth:
          error instanceof GoogleIdentityConflictError ? "conflict" : "error",
      });
    }
  }

  try {
    const consumers = new D1ConsumerRepository();
    const consumer = await consumers.upsertFromGoogle(identity);
    if (consumer.status !== "active") return back({ auth: "suspended" });

    await createConsumerSession(consumer.id);

    // Un proveedor ya vinculado que entra desde el formulario de opinión
    // recupera las dos capacidades con una sola autenticación de Google.
    const linkedUserId = await consumers.findLinkedUserId(consumer.id);
    if (linkedUserId) {
      const linkedUser = await new D1UserRepository().findById(linkedUserId);
      if (linkedUser?.isActive && linkedUser.role === "provider") {
        try {
          await createSession(linkedUser.id);
        } catch (error) {
          // La persona ya puede opinar; no se invalida ese ingreso si la
          // restauración adicional del panel falla.
          console.error(
            "Linked provider session creation failed",
            error instanceof Error ? error.message : "unknown",
          );
        }
      }
    }
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

async function linkCurrentProvider(
  users: D1UserRepository,
  identity: Parameters<D1UserRepository["linkGoogle"]>[1],
) {
  const current = await getCurrentUser();
  if (!current?.isActive || current.role !== "provider") {
    throw new GoogleIdentityConflictError();
  }
  return users.linkGoogle(current.id, identity);
}
