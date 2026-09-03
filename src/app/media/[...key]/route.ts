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

  /*
   * Las cabeceras se arman leyendo `httpMetadata` en vez de con
   * `object.writeHttpMetadata(headers)`.
   *
   * Hacen lo mismo, pero `writeHttpMetadata` recibe el `Headers` como
   * argumento, y en `next dev` R2 se habla por el proxy de miniflare: cada
   * llamada cruza un límite de proceso y sus argumentos se serializan con
   * devalue, que sólo admite objetos planos. Un `Headers` no lo es, así que
   * la llamada explotaba con «Cannot stringify arbitrary non-POJOs» y toda
   * imagen del perfil se veía rota en desarrollo.
   *
   * Leer la propiedad no cruza nada: el objeto ya vino con sus metadatos.
   * En producción el resultado es idéntico.
   */
  const headers = new Headers();
  const metadata = object.httpMetadata;

  // `contentType` es el que importa para que el navegador dibuje la imagen en
  // vez de ofrecer una descarga. El resto se copia si viene.
  if (metadata?.contentType) headers.set("content-type", metadata.contentType);
  if (metadata?.contentLanguage)
    headers.set("content-language", metadata.contentLanguage);
  if (metadata?.contentDisposition)
    headers.set("content-disposition", metadata.contentDisposition);
  if (metadata?.contentEncoding)
    headers.set("content-encoding", metadata.contentEncoding);

  headers.set("etag", object.httpEtag);
  // Las claves incluyen un id único: el contenido de una clave nunca cambia.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
