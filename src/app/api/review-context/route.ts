import { D1ReviewRepository } from "@/infrastructure/d1-repositories";
import { hasCloudflareRuntime } from "@/infrastructure/cloudflare";
import { getCurrentConsumer } from "@/lib/consumer-session";
import { isGoogleEnabled } from "@/lib/google-oauth";

/** Depende de la cookie de quien pregunta: nunca se cachea. */
export const dynamic = "force-dynamic";

/**
 * Estado de opinión para el perfil público.
 *
 * La página del proveedor se sirve desde caché (`revalidate`), así que no
 * puede leer la sesión: el HTML quedaría con la identidad del primer
 * visitante. El formulario consulta esto desde el cliente, igual que hace el
 * header con `/api/session`, y así el perfil sigue siendo estático y bueno
 * para SEO (RF-121).
 */
export async function GET(request: Request): Promise<Response> {
  const providerId = new URL(request.url).searchParams.get("providerId");

  const empty = {
    consumer: null,
    existing: null,
    googleEnabled: isGoogleEnabled(),
  };

  if (!hasCloudflareRuntime() || !providerId) {
    return Response.json(empty, {
      headers: { "cache-control": "no-store" },
    });
  }

  const consumer = await getCurrentConsumer();
  if (!consumer) {
    return Response.json(empty, {
      headers: { "cache-control": "no-store" },
    });
  }

  const existing = await new D1ReviewRepository().findByConsumer(
    providerId,
    consumer.id,
  );

  return Response.json(
    { consumer, existing, googleEnabled: isGoogleEnabled() },
    { headers: { "cache-control": "no-store" } },
  );
}
