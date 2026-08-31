import { getMediaBucket } from "@/infrastructure/cloudflare";

/**
 * Sirve las imágenes guardadas en R2.
 *
 * El bucket no se expone públicamente: se accede por acá para poder controlar
 * cache y, más adelante, transformaciones o permisos.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const objectKey = key.join("/");

  // Sólo se sirven claves del espacio de proveedores: evita que una ruta
  // manipulada alcance otros objetos del bucket.
  if (!objectKey.startsWith("providers/") || objectKey.includes("..")) {
    return new Response("No encontrado", { status: 404 });
  }

  const object = await getMediaBucket().get(objectKey);
  if (!object) {
    return new Response("No encontrado", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Las claves incluyen un id único: el contenido de una clave nunca cambia.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
