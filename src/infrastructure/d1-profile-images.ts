import "server-only";

import { getDb, getMediaBucket } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import type { ImageKind, ProfileImage } from "@/types";

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
  sort_order: number;
  is_active: number;
};

function toImage(row: ImageRow): ProfileImage {
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: `/media/${row.storage_key}`,
    alt: row.alt,
    kind: row.kind as ImageKind,
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
  };
}

/**
 * Imágenes que subió un usuario, tenga perfil o no.
 *
 * El panel las pide por usuario y no por perfil: durante el alta las filas
 * todavía no están reclamadas, y filtrar por `profile_id` no devolvería
 * nada justo cuando hay que mostrar lo recién subido.
 */
export async function listImagesForUser(
  userId: string,
): Promise<ProfileImage[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, storage_key, alt, kind, sort_order, is_active
         FROM profile_images
        WHERE owner_user_id = ?
        ORDER BY kind, sort_order`,
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
export async function putProfileImage(input: {
  userId: string;
  /** Null durante el alta: la fila se reclama al crear el perfil. */
  profileId: string | null;
  kind: ImageKind;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  alt?: string;
}): Promise<ProfileImage> {
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
            `SELECT id, storage_key FROM profile_images
              WHERE owner_user_id = ? AND kind = ?`,
          )
          .bind(input.userId, input.kind)
          .first<{ id: string; storage_key: string }>();

  const position =
    input.kind === "gallery"
      ? ((
          await db
            .prepare(
              `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next
                 FROM profile_images
                WHERE owner_user_id = ? AND kind = 'gallery'`,
            )
            .bind(input.userId)
            .first<{ next: number }>()
        )?.next ?? 0)
      : 0;

  const now = new Date().toISOString();

  const statements = [];
  if (replaced) {
    statements.push(
      db.prepare(`DELETE FROM profile_images WHERE id = ?`).bind(replaced.id),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO profile_images
           (id, profile_id, owner_user_id, storage_key, alt, sort_order, kind,
            is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        input.profileId,
        input.userId,
        key,
        input.alt ?? "",
        position,
        input.kind,
        now,
        now,
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
    sortOrder: position,
    isActive: true,
  };
}

/**
 * Borra una imagen propia. Devuelve false si no era de quien la pide, para
 * que la acción responda igual que ante una imagen inexistente y no confirme
 * que el id existe.
 */
export async function deleteProfileImage(
  imageId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();

  const row = await db
    .prepare(
      `SELECT storage_key FROM profile_images WHERE id = ? AND owner_user_id = ?`,
    )
    .bind(imageId, userId)
    .first<{ storage_key: string }>();

  if (!row) return false;

  await db.prepare(`DELETE FROM profile_images WHERE id = ?`).bind(imageId).run();
  await deleteObject(row.storage_key);

  return true;
}

/**
 * Cuelga del perfil recién creado las imágenes que se subieron durante el
 * alta, cuando todavía no había a quién colgarlas.
 */
export async function claimImagesForProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE profile_images SET profile_id = ?
        WHERE owner_user_id = ? AND profile_id IS NULL`,
    )
    .bind(profileId, userId)
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
  /** `null` es "sin límite" (TR-002): entran todas. */
  limit: number | null,
): Promise<void> {
  const db = getDb();

  const { results } = await db
    .prepare(
      `SELECT id FROM profile_images
        WHERE owner_user_id = ? AND kind = 'gallery'
        ORDER BY sort_order`,
    )
    .bind(userId)
    .all<{ id: string }>();

  const ids = (results ?? []).map((row) => row.id);
  if (ids.length === 0) return;

  const active = limit === null ? ids : ids.slice(0, limit);
  const inactive = limit === null ? [] : ids.slice(limit);

  const now = new Date().toISOString();

  const statements = [];
  if (active.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE profile_images SET is_active = 1, updated_at = ?
            WHERE id IN (${active.map(() => "?").join(",")})`,
        )
        .bind(now, ...active),
    );
  }
  if (inactive.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE profile_images SET is_active = 0, updated_at = ?
            WHERE id IN (${inactive.map(() => "?").join(",")})`,
        )
        .bind(now, ...inactive),
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
