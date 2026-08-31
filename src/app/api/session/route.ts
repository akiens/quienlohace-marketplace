import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { getCurrentUser } from "@/lib/session";

/** Nunca se cachea: la respuesta depende de la cookie de quien pregunta. */
export const dynamic = "force-dynamic";

/**
 * Estado de sesión para el header.
 *
 * El header lo consulta desde el cliente en vez de leer la cookie en el
 * layout: si el layout usara `cookies()`, todo el sitio pasaría a ser
 * dinámico y las páginas estáticas —que son la base del SEO— dejarían de
 * pregenerarse.
 */
export async function GET() {
  if (!hasCloudflareRuntime()) {
    return Response.json({ signedIn: false });
  }

  const user = await getCurrentUser();

  return Response.json(
    { signedIn: user !== null, name: user?.name ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
