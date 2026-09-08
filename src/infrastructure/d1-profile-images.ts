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
 * Ese ciclo de vida es el de TR-043. Una imagen recién subida nace `pending`:
 * está guardada y es de quien la subió, pero todavía no la confirmó ningún
 * formulario y expira sola. Guardar la confirma; cancelar la deja expirar. Lo
 * que la limpieza se lleva es sólo lo que nadie confirmó.
 *
 * La clave de R2 se arma con el usuario y no con el perfil —`providers/<user>/…`—
 * porque durante el alta el perfil todavía no existe. El prefijo sigue siendo
 * `providers/`, que es lo único que la ruta `/media` acepta servir.
 */

/** Cuánto vive una imagen que nadie confirmó (TR-043). */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Fila tal como vuelve de D1. */
type ImageRow = {
  id: string;
  storage_key: string;
  alt: string;
  kind: string;
  sort_order: number;
  is_active: number;
  lifecycle: string;
  width: number;
  height: number;
};

const COLUMNS = `id, storage_key, alt, kind, sort_order, is_active, lifecycle, width, height`;

function toImage(row: ImageRow): ProfileImage {
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: `/media/${row.storage_key}`,
    alt: row.alt,
    kind: row.kind as ImageKind,
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
    lifecycle: row.lifecycle as ProfileImage["lifecycle"],
    width: Number(row.width),
    height: Number(row.height),
  };
}

/**
 * Imágenes vigentes de un usuario: las confirmadas y las que subió en esta
 * edición y todavía no guardó.
 *
 * El panel las pide por usuario y no por perfil: durante el alta las filas
 * todavía no están reclamadas, y filtrar por `profile_id` no devolvería
 * nada justo cuando hay que mostrar lo recién subido.
 *
 * Las `discarded` no salen: están marcadas para la limpieza y mostrarlas
 * sería revivir algo que ya se quitó.
 */
export async function listImagesForUser(
  userId: string,
): Promise<ProfileImage[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT ${COLUMNS}
         FROM profile_images
        WHERE owner_user_id = ?
          AND lifecycle IN ('pending', 'confirmed')
        ORDER BY kind, sort_order`,
    )
    .bind(userId)
    .all<ImageRow>();

  return (results ?? []).map(toImage);
}

/** Sólo las confirmadas: lo que el perfil muestra de verdad. */
export async function listConfirmedImages(
  userId: string,
): Promise<ProfileImage[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT ${COLUMNS}
         FROM profile_images
        WHERE owner_user_id = ? AND lifecycle = 'confirmed'
        ORDER BY kind, sort_order`,
    )
    .bind(userId)
    .all<ImageRow>();

  return (results ?? []).map(toImage);
}

/**
 * Guarda una imagen recién subida, en estado pendiente.
 *
 * Primero el objeto en R2 y después la fila en D1: una fila que apunta a un
 * objeto inexistente se ve como una imagen rota, mientras que un objeto sin
 * fila no se ve en ningún lado y lo levanta la limpieza. Ante un fallo, el
 * daño menor.
 *
 * A diferencia de antes, subir una foto de perfil **no** borra la anterior:
 * las dos conviven hasta que el formulario se guarde, que es lo que permite
 * cancelar la edición sin haber perdido nada (TR-043).
 */
export async function putProfileImage(input: {
  userId: string;
  /** Null durante el alta: la fila se reclama al crear el perfil. */
  profileId: string | null;
  kind: ImageKind;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  alt?: string;
}): Promise<ProfileImage> {
  const db = getDb();
  const id = newId();
  const key = `providers/${input.userId}/${input.kind}-${id}.${input.extension}`;

  await getMediaBucket().put(key, input.body, {
    httpMetadata: { contentType: input.contentType },
  });

  const position =
    input.kind === "gallery"
      ? ((
          await db
            .prepare(
              `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next
                 FROM profile_images
                WHERE owner_user_id = ? AND kind = 'gallery'
                  AND lifecycle IN ('pending', 'confirmed')`,
            )
            .bind(input.userId)
            .first<{ next: number }>()
        )?.next ?? 0)
      : 0;

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + PENDING_TTL_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO profile_images
         (id, profile_id, owner_user_id, storage_key, alt, sort_order, kind,
          is_active, lifecycle, expires_at, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.profileId,
      input.userId,
      key,
      input.alt ?? "",
      position,
      input.kind,
      expiresAt,
      input.width,
      input.height,
      nowIso,
      nowIso,
    )
    .run();

  return {
    id,
    storageKey: key,
    url: `/media/${key}`,
    alt: input.alt ?? "",
    kind: input.kind,
    sortOrder: position,
    isActive: true,
    lifecycle: "pending",
    width: input.width,
    height: input.height,
  };
}

/**
 * Descarta una imagen pendiente propia: la que se subió y se quitó antes de
 * guardar.
 *
 * Se borra de verdad, fila y objeto: nunca estuvo en ningún perfil, así que
 * no hay nada que preservar. Una **confirmada** no se toca por acá — quitarla
 * es marcarla, y eso lo decide el guardado del formulario (TR-043).
 *
 * Devuelve false si no era suya o si ya estaba confirmada, para responder
 * igual que ante una imagen inexistente y no confirmar que el id existe.
 */
export async function discardPendingImage(
  imageId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();

  const row = await db
    .prepare(
      `SELECT storage_key FROM profile_images
        WHERE id = ? AND owner_user_id = ? AND lifecycle = 'pending'`,
    )
    .bind(imageId, userId)
    .first<{ storage_key: string }>();

  if (!row) return false;

  await db.prepare(`DELETE FROM profile_images WHERE id = ?`).bind(imageId).run();
  await deleteObject(row.storage_key);

  return true;
}

/**
 * Aplica al guardar el formulario lo que se decidió mientras se editaba
 * (TR-043).
 *
 * Es el único momento en que una imagen cambia de estado, y va en un solo
 * lote: o queda todo aplicado o no queda nada, para que el formulario no
 * pueda terminar con la foto nueva puesta y la vieja todavía colgando.
 *
 * - `keepIds`: las que quedan. Las pendientes pasan a confirmadas.
 * - El resto de las confirmadas del mismo tipo se marcan `discarded`.
 *
 * Los ids que no sean del usuario se ignoran: la pertenencia se comprueba en
 * el `WHERE`, no en quien llama (TR-004).
 */
export async function commitImageSelection(input: {
  userId: string;
  profileId: string;
  /** Los tipos que este guardado decide. No toca los que no menciona. */
  kinds: ImageKind[];
  /** Las que quedan, en el orden en que se muestran. */
  keepIds: string[];
}): Promise<void> {
  const db = getDb();
  const { userId, profileId, kinds, keepIds } = input;

  if (kinds.length === 0) return;

  const now = new Date().toISOString();
  const kindSlots = kinds.map(() => "?").join(",");

  const statements = [];

  /*
   * Lo que se va: confirmado de estos tipos que no está en la lista. No se
   * borra nada todavía —el archivo puede seguir referenciado, y borrarlo acá
   * dejaría un hueco si el guardado falla después—: queda marcado y lo
   * levanta la limpieza (TR-043).
   */
  const keepSlots = keepIds.map(() => "?").join(",");
  statements.push(
    db
      .prepare(
        `UPDATE profile_images
            SET lifecycle = 'discarded', updated_at = ?, expires_at = ?
          WHERE owner_user_id = ?
            AND kind IN (${kindSlots})
            AND lifecycle = 'confirmed'
            ${keepIds.length > 0 ? `AND id NOT IN (${keepSlots})` : ""}`,
      )
      .bind(now, now, userId, ...kinds, ...keepIds),
  );

  /*
   * Lo que queda: confirmado, colgado del perfil, y en la posición que le
   * tocó. El orden se escribe de a una fila porque cada una lleva el suyo.
   */
  keepIds.forEach((imageId, index) => {
    statements.push(
      db
        .prepare(
          `UPDATE profile_images
              SET lifecycle = 'confirmed',
                  expires_at = NULL,
                  profile_id = ?,
                  sort_order = ?,
                  updated_at = ?
            WHERE id = ? AND owner_user_id = ?
              AND lifecycle IN ('pending', 'confirmed')`,
        )
        .bind(profileId, index, now, imageId, userId),
    );
  });

  await db.batch(statements);
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
        WHERE owner_user_id = ? AND profile_id IS NULL
          AND lifecycle IN ('pending', 'confirmed')`,
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
        WHERE owner_user_id = ? AND kind = 'gallery' AND lifecycle = 'confirmed'
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
 * Limpieza de lo que quedó sin confirmar (TR-043).
 *
 * Se lleva dos cosas: lo pendiente que venció —alguien abrió el formulario,
 * subió una foto y se fue— y lo descartado por un guardado. En los dos casos
 * la fila se vuelve a comprobar en el `DELETE`, con el mismo estado con el
 * que se la eligió: si entre la consulta y el borrado alguien la confirmó, el
 * `WHERE` ya no la encuentra y la imagen se salva.
 *
 * El objeto se borra después de la fila y sin dejar que un fallo corte la
 * pasada: un objeto huérfano no se ve en ningún lado y lo vuelve a intentar
 * la próxima. Al revés —objeto borrado y fila viva— sería una imagen rota en
 * un perfil.
 */
export async function cleanupExpiredImages(
  limit = 100,
): Promise<{ removed: number; failed: number }> {
  const db = getDb();
  const now = new Date().toISOString();

  const { results } = await db
    .prepare(
      `SELECT id, storage_key, lifecycle FROM profile_images
        WHERE (lifecycle = 'pending' AND expires_at IS NOT NULL AND expires_at < ?)
           OR lifecycle = 'discarded'
        LIMIT ?`,
    )
    .bind(now, limit)
    .all<{ id: string; storage_key: string; lifecycle: string }>();

  let removed = 0;
  let failed = 0;

  for (const row of results ?? []) {
    try {
      /*
       * El estado va en el `WHERE`: entre la consulta y esta línea el
       * formulario pudo haberla confirmado, y en ese caso no se borra.
       */
      const outcome = await db
        .prepare(
          `DELETE FROM profile_images WHERE id = ? AND lifecycle = ?`,
        )
        .bind(row.id, row.lifecycle)
        .run();

      if (outcome.meta.changes === 0) continue;

      /*
       * El objeto sólo se borra si ninguna otra fila lo referencia. Hoy la
       * clave es única por fila, pero comprobarlo es lo que impide que un
       * reemplazo se lleve por delante el archivo que otra imagen todavía
       * usa (TR-043).
       */
      const stillUsed = await db
        .prepare(
          `SELECT 1 FROM profile_images WHERE storage_key = ? LIMIT 1`,
        )
        .bind(row.storage_key)
        .first();

      if (!stillUsed) await getMediaBucket().delete(row.storage_key);

      removed += 1;
    } catch (error) {
      // Una que falla no corta la pasada: se reintenta en la próxima.
      console.error("cleanupExpiredImages failed for", row.id, error);
      failed += 1;
    }
  }

  return { removed, failed };
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
