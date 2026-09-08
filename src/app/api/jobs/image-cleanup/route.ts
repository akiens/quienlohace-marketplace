import { cleanupExpiredImages } from "@/infrastructure/d1-profile-images";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Limpieza de imágenes pendientes, descartadas y excedentes vencidos (TR-043, BR-032).
 *
 * Se lleva lo pendiente que venció —alguien abrió un formulario, subió una
 * foto y se fue—, lo descartado y los excedentes congelados o semicongelados
 * cuyo plazo de 180 días venció. Las ocultas voluntariamente no vencen.
 *
 * Es una ruta y no un `scheduled` handler porque el sitio se despliega con el
 * adaptador de Next sobre Workers, que ya toma el `main` del worker: agregar
 * un handler propio obligaría a envolverlo. Una ruta se puede llamar desde un
 * Cron Trigger, desde un servicio externo o a mano, y no cambia el modelo de
 * despliegue.
 *
 * Se protege con un secreto (`CLEANUP_TOKEN`): borra datos, y sin él
 * cualquiera podría dispararla. Si el secreto no está configurado la ruta no
 * corre — es preferible que la limpieza no ocurra a que quede abierta.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let expected: string | undefined;
  try {
    expected = (getCloudflareContext().env as CloudflareEnv & {
      CLEANUP_TOKEN?: string;
    }).CLEANUP_TOKEN;
  } catch {
    expected = undefined;
  }

  if (!expected) {
    return Response.json(
      { ok: false, error: "La limpieza no está configurada." },
      { status: 503 },
    );
  }

  /*
   * La comparación es directa y no de tiempo constante: el token es largo y
   * aleatorio, y el atacante no puede medir el tiempo del worker con la
   * precisión que haría falta. Lo que sí importa es no decir por qué falló.
   */
  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${expected}`) {
    return Response.json({ ok: false }, { status: 404 });
  }

  try {
    const result = await cleanupExpiredImages();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // TR-041: el detalle al log, nada de eso al que llama.
    console.error("image cleanup failed", error);
    return Response.json(
      { ok: false, error: "La limpieza falló." },
      { status: 500 },
    );
  }
}
