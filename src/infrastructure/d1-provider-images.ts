import "server-only";

import { getDb, getMediaBucket } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import type { ImageKind, ProviderImage } from "@/types";

/**
 * Imágenes del perfil: el binario vive en R2 y la fila en D1 (RF-012).
 *
 * Está separado del repositorio de perfiles porque las imágenes tienen su
 * propio ciclo de vida: se suben de a una, apenas se eligen, y pueden existir
 * antes que el perfil. El resto del formulario, en cambio, viaja entero en un
 * único guardado.
 *
 * La clave de R2 se arma con el usuario y no con el perfil —`providers/<user>/…`—
 * porque durante el alta el perfil todavía no existe. El prefijo sigue siendo
 * `providers/`, que es lo único que la ruta `/media` acepta servir.
 */

/** Fila tal como vuelve de D1. */
type ImageRow = {
  id: string;
  storage_key: string;
  alt: string;
  kind: string;
  active: number;
};

function toImage(row: ImageRow): ProviderImage {
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: `/media/${row.storage_key}`,
    alt: row.alt,
    kind: row.kind as ImageKind,
    active: Number(row.active) === 1,
  };
}

/**
 * Imágenes que subió un usuario, tenga perfil o no.
 *
 * El panel las pide por usuario y no por perfil: durante el alta las filas
 * todavía no están reclamadas, y filtrar por `provider_id` no devolvería
 * nada justo cuando hay que mostrar lo recién subido.
 */
export async function listImagesForUser(
  userId: string,
): Promise<ProviderImage[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, storage_key, alt, kind, active
         FROM provider_images
        WHERE owner_user_id = ?
        ORDER BY kind, position`,
    )
    .bind(userId)
    .all<ImageRow>();

  return (results ?? []).map(toImage);
}

/**
 * Guarda una imagen: primero el objeto en R2, después la fila en D1.
 *
 * En ese orden porque una fila que apunta a un objeto inexistente se ve como
 * una imagen rota en el perfil, mientras que un objeto sin fila no se ve en
 * ningún lado y lo levanta la limpieza. Ante un fallo, el daño menor.
 *
 * `avatar` y `cover` son únicas: subir una nueva reemplaza la anterior y
 * borra su objeto, para que el bucket no acumule fotos que ya nadie mira.
 */
export async function putProviderImage(input: {
  userId: string;
  /** Null durante el alta: la fila se reclama al crear el perfil. */
  providerId: string | null;
  kind: ImageKind;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  alt?: string;
}): Promise<ProviderImage> {
  const db = getDb();
  const id = newId();
  const key = `providers/${input.userId}/${input.kind}-${id}.${input.extension}`;

  await getMediaBucket().put(key, input.body, {
    httpMetadata: { contentType: input.contentType },
  });

  // La que se reemplaza, para borrar su objeto una vez que la nueva ya está.
  const replaced =
    input.kind === "gallery"
      ? null
      : await db
          .prepare(
            `SELECT id, storage_key FROM provider_images
              WHERE owner_user_id = ? AND kind = ?`,
          )
          .bind(input.userId, input.kind)
          .first<{ id: string; storage_key: string }>();

  const position =
    input.kind === "gallery"
      ? ((
          await db
            .prepare(
              `SELECT COALESCE(MAX(position) + 1, 0) AS next
                 FROM provider_images
                WHERE owner_user_id = ? AND kind = 'gallery'`,
            )
            .bind(input.userId)
            .first<{ next: number }>()
        )?.next ?? 0)
      : 0;

  const statements = [];
  if (replaced) {
    statements.push(
      db.prepare(`DELETE FROM provider_images WHERE id = ?`).bind(replaced.id),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO provider_images
           (id, provider_id, owner_user_id, storage_key, alt, position, kind,
            active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(
        id,
        input.providerId,
        input.userId,
        key,
        input.alt ?? "",
        position,
        input.kind,
        new Date().toISOString(),
      ),
  );

  // El reemplazo va en lote: nunca quedan dos filas del mismo rol, que es lo
  // que el índice único no permitiría de todos modos.
  await db.batch(statements);

  if (replaced) await deleteObject(replaced.storage_key);

  return {
    id,
    storageKey: key,
    url: `/media/${key}`,
    alt: input.alt ?? "",
    kind: input.kind,
    active: true,
  };
}

/**
 * Borra una imagen propia. Devuelve false si no era de quien la pide, para
 * que la acción responda igual que ante una imagen inexistente y no confirme
 * que el id existe.
 */
export async function deleteProviderImage(
  imageId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();

  const row = await db
    .prepare(
      `SELECT storage_key FROM provider_images WHERE id = ? AND owner_user_id = ?`,
    )
    .bind(imageId, userId)
    .first<{ storage_key: string }>();

  if (!row) return false;

  await db.prepare(`DELETE FROM provider_images WHERE id = ?`).bind(imageId).run();
  await deleteObject(row.storage_key);

  return true;
}

/**
 * Cuelga del perfil recién creado las imágenes que se subieron durante el
 * alta, cuando todavía no había a quién colgarlas.
 */
export async function claimImagesForProvider(
  userId: string,
  providerId: string,
): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE provider_images SET provider_id = ?
        WHERE owner_user_id = ? AND provider_id IS NULL`,
    )
    .bind(providerId, userId)
    .run();
}

/**
 * Aplica el tope de galería del plan (RF-053).
 *
 * No borra nada: lo que excede queda guardado e inactivo, así volver al plan
 * anterior lo repone sin tener que subirlo de nuevo. La foto de perfil y la
 * portada nunca se desactivan — las incluyen todos los planes.
 */
export async function applyGalleryLimit(
  userId: string,
  limit: number,
): Promise<void> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT id FROM provider_images
        WHERE owner_user_id = ? AND kind = 'gallery'
        ORDER BY position`,
    )
    .bind(userId)
    .all<{ id: string }>();

  const ids = (results ?? []).map((row) => row.id);
  if (ids.length === 0) return;

  const active = ids.slice(0, limit);
  const inactive = ids.slice(limit);

  const statements = [];
  if (active.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE provider_images SET active = 1
            WHERE id IN (${active.map(() => "?").join(",")})`,
        )
        .bind(...active),
    );
  }
  if (inactive.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE provider_images SET active = 0
            WHERE id IN (${inactive.map(() => "?").join(",")})`,
        )
        .bind(...inactive),
    );
  }

  await db.batch(statements);
}

/**
 * Borra el objeto de R2 sin dejar que un fallo tumbe la operación: la fila
 * ya no está, así que la imagen desapareció del perfil. Un objeto huérfano no
 * se ve en ningún lado y no justifica devolver un error a quien sólo quería
 * cambiar su foto.
 */
async function deleteObject(key: string): Promise<void> {
  try {
    await getMediaBucket().delete(key);
  } catch {
    // Intencionalmente en silencio: ver el comentario de arriba.
  }
}
