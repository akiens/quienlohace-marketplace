import "server-only";

import { getDb, getMediaBucket } from "@/infrastructure/cloudflare";
import { effectivePlanId } from "@/domain/plan-changes";
import type { PlanId, SubscriptionStatus } from "@/types";
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
  hidden_reason: string | null;
  gallery_state: ProfileImage["galleryState"];
  owner_hidden: number;
  hidden_at: string | null;
  lifecycle: string;
  width: number;
  height: number;
};

const COLUMNS = `id, storage_key, alt, kind, sort_order, is_active, hidden_reason,
                 gallery_state, owner_hidden, hidden_at, lifecycle, width, height`;

function toImage(
  row: ImageRow,
  gallery?: Pick<GalleryState, "revision" | "selection_pending"> | null,
): ProfileImage {
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: `/media/${row.storage_key}`,
    alt: row.alt,
    kind: row.kind as ImageKind,
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
    hiddenReason: (row.hidden_reason ?? null) as ProfileImage["hiddenReason"],
    galleryState: row.gallery_state,
    ownerHidden: Number(row.owner_hidden) === 1,
    hiddenAt: row.hidden_at,
    galleryRevision: gallery?.revision ?? null,
    gallerySelectionPending: gallery?.selection_pending === 1,
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
  const state = await syncGalleryForUser(userId);
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

  return (results ?? []).map((row) => toImage(row, state));
}

/** Sólo las confirmadas: lo que el perfil muestra de verdad. */
export async function listConfirmedImages(
  userId: string,
): Promise<ProfileImage[]> {
  const state = await syncGalleryForUser(userId);
  const { results } = await getDb()
    .prepare(
      `SELECT ${COLUMNS}
         FROM profile_images
        WHERE owner_user_id = ? AND lifecycle = 'confirmed'
        ORDER BY kind, sort_order`,
    )
    .bind(userId)
    .all<ImageRow>();

  return (results ?? []).map((row) => toImage(row, state));
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
  /** Cupo ya validado durante el alta, cuando aún no hay perfil que consultarlo. */
  galleryPlanLimit?: number | null;
  kind: ImageKind;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  alt?: string;
}): Promise<ProfileImage> {
  const db = getDb();
  if (input.kind === "gallery") {
    if (input.profileId === null && input.galleryPlanLimit !== undefined) {
      await applyGalleryLimit(input.userId, input.galleryPlanLimit);
    } else {
      await syncGalleryForUser(input.userId);
    }
  }
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

  const inserted = await db
    .prepare(
      `INSERT INTO profile_images
         (id, profile_id, owner_user_id, storage_key, alt, sort_order, kind,
          is_active, lifecycle, expires_at, width, height, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?
       WHERE ? <> 'gallery' OR EXISTS (
         SELECT 1 FROM profile_gallery_state g WHERE g.user_id = ?
           AND g.selection_pending = 0 AND (g.plan_limit IS NULL OR
             (SELECT COUNT(*) FROM profile_images WHERE owner_user_id = g.user_id
               AND kind = 'gallery' AND gallery_state = 'available'
               AND lifecycle IN ('pending', 'confirmed')) < g.plan_limit))`,
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
      input.kind,
      input.userId,
    )
    .run();

  if (inserted.meta.changes !== 1) {
    await deleteObject(key);
    throw new Error("No hay cupo disponible o falta confirmar la selección de galería.");
  }
  return {
    id,
    storageKey: key,
    url: `/media/${key}`,
    alt: input.alt ?? "",
    kind: input.kind,
    sortOrder: position,
    isActive: true,
    hiddenReason: null,
    galleryState: "available",
    ownerHidden: false,
    hiddenAt: null,
    galleryRevision: null,
    gallerySelectionPending: false,
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

/** Guarda visibilidad y selección con control de versión en un único batch D1. */
export async function commitImageSelection(input: {
  userId: string;
  profileId: string;
  kinds: ImageKind[];
  keepIds: string[];
  activeIds: string[];
  galleryRevision?: string | null;
  selectedIds?: string[];
}): Promise<void> {
  const db = getDb();
  const { userId, profileId, kinds } = input;
  if (!kinds.length) return;
  const gallery = kinds.includes("gallery");
  const state = gallery ? await syncGalleryForUser(userId) : null;
  const rows = (await db.prepare(`SELECT ${COLUMNS} FROM profile_images
    WHERE owner_user_id = ? AND lifecycle IN ('pending', 'confirmed')`)
    .bind(userId).all<ImageRow>()).results.filter(row => kinds.includes(row.kind as ImageKind));
  const keep = [...new Set(input.keepIds)];
  const active = new Set(input.activeIds);
  const selecting = input.selectedIds !== undefined;
  const selected = new Set(input.selectedIds ?? []);
  if (selecting && rows.some(row => row.lifecycle === "pending" && keep.includes(row.id))) throw new Error("Guardá la selección antes de agregar nuevas imágenes.");
  if (keep.some(id => !rows.some(row => row.id === id)) ||
      [...active].some(id => !keep.includes(id))) throw new Error("Selección de imágenes inválida.");
  if (gallery && (!state || (rows.some(row => row.lifecycle === "confirmed") && input.galleryRevision !== state.revision))) {
    throw new Error("La galería cambió. Recargá la página antes de guardar.");
  }
  if (selecting && (!state?.selection_pending || !input.galleryRevision ||
      selected.size !== input.selectedIds!.length ||
      [...selected].some(id => !rows.some(row => row.id === id && row.kind === 'gallery' && row.lifecycle === 'confirmed')) ||
      (state.plan_limit !== null && selected.size > state.plan_limit))) {
    throw new Error("La selección única ya se guardó o no respeta el cupo.");
  }
  if (!selecting && rows.some(row => row.gallery_state !== 'available' && active.has(row.id))) {
    throw new Error("No se pueden mostrar imágenes congeladas.");
  }
  const occupying = rows.filter(row => keep.includes(row.id) && row.gallery_state === 'available');
  if (gallery && !selecting && state?.plan_limit !== null && occupying.length > state!.plan_limit!) {
    throw new Error("Las imágenes ocultas también ocupan cupo.");
  }
  const now = new Date().toISOString();
  const token = newId();
  const statements: D1PreparedStatement[] = [];
  const guard = gallery ? ` AND EXISTS (SELECT 1 FROM profile_gallery_state WHERE user_id = ? AND revision = ?)` : '';
  const guardArgs = gallery ? [userId, token] : [];
  if (state) statements.push(db.prepare(`UPDATE profile_gallery_state
    SET revision = ?, selection_pending = ? WHERE user_id = ? AND revision = ?`)
    .bind(token, selecting ? 0 : state.selection_pending, userId, state.revision));
  // Agrupar habilitadas antes de ocultas también en el servidor.
  const ordered = rows.filter(row => keep.includes(row.id) || row.gallery_state !== 'available')
    .sort((a, b) => {
      const rank = (row: ImageRow) => selecting
        ? selected.has(row.id) ? row.owner_hidden ? 1 : 0 : 2
        : row.gallery_state !== 'available' ? 2 : active.has(row.id) ? 0 : 1;
      return rank(a) - rank(b) || keep.indexOf(a.id) - keep.indexOf(b.id);
    }).map(row => row.id);
  for (const row of rows) {
    const planState = selecting ? (selected.has(row.id) ? 'available' : 'frozen') : row.gallery_state;
    // Omitir un excedente desde un formulario viejo nunca lo descarta.
    const discarded = !selecting && row.gallery_state === 'available' && !keep.includes(row.id);
    if (row.lifecycle === 'pending' && !keep.includes(row.id)) continue;
    const ownerHidden = selecting ? row.owner_hidden : planState === 'available' ? (active.has(row.id) ? 0 : 1) : row.owner_hidden;
    const visible = planState === 'available' && !ownerHidden;
    const hiddenAt = planState === 'available' ? null : row.hidden_at ?? state?.retention_started_at ?? now;
    statements.push(db.prepare(`UPDATE profile_images SET profile_id = ?, lifecycle = ?,
      expires_at = ?, sort_order = ?, is_active = ?, hidden_reason = ?, owner_hidden = ?,
      gallery_state = ?, hidden_at = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ? AND kind = ? AND lifecycle IN ('pending', 'confirmed')${guard}`)
      .bind(profileId, discarded ? 'discarded' : 'confirmed', discarded ? now : null,
        Math.max(0, ordered.indexOf(row.id)), visible ? 1 : 0,
        planState !== 'available' ? 'plan' : ownerHidden ? 'owner' : null,
        ownerHidden, planState, hiddenAt, now, row.id, userId, row.kind, ...guardArgs));
  }

  // Avatar y portada forman parte del formulario aunque la persona no haya
  // subido ninguna imagen. En ese caso no hay nada que confirmar: D1 rechaza
  // `batch([])`, así que el resultado correcto es terminar sin escribir.
  if (statements.length === 0) return;

  const results = await db.batch(statements);
  if (state && results[0]?.meta.changes !== 1) throw new Error("La galería cambió. Recargá la página.");
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

export type GalleryState = {
  plan_limit: number | null;
  revision: string;
  selection_pending: number;
  retention_started_at: string | null;
};

/** Resuelve el plan vigente incluso si la baja programada todavía no se consolidó. */
export async function syncGalleryForUser(userId: string): Promise<GalleryState | null> {
  const db = getDb();
  const profile = await db.prepare(`SELECT plan_id, subscription_status, downgrade_plan_id, plan_expires_at
    FROM profiles WHERE user_id = ?`).bind(userId).first<{
      plan_id: PlanId; subscription_status: SubscriptionStatus;
      downgrade_plan_id: PlanId | null; plan_expires_at: string | null;
    }>();
  if (!profile) return null;
  const planId = effectivePlanId({
    planId: profile.plan_id,
    subscriptionStatus: profile.subscription_status,
    downgradePlanId: profile.downgrade_plan_id,
    planExpiresAt: profile.plan_expires_at,
  });
  const plan = await db.prepare('SELECT max_gallery_images FROM plans WHERE id = ?')
    .bind(planId).first<{ max_gallery_images: number | null }>();
  await applyGalleryLimit(userId, plan ? plan.max_gallery_images : 0);
  return db.prepare('SELECT * FROM profile_gallery_state WHERE user_id = ?').bind(userId).first<GalleryState>();
}

/** Sólo un cambio de cupo abre una selección; guardar u ocultar nunca la reabre. */
export async function applyGalleryLimit(userId: string, limit: number | null): Promise<void> {
  const db = getDb();
  const prior = await db.prepare('SELECT * FROM profile_gallery_state WHERE user_id = ?')
    .bind(userId).first<GalleryState>();
  if (prior && prior.plan_limit === limit) {
    // Al vencer todos los excedentes ya no queda una selección que confirmar.
    if (prior.selection_pending) {
      await db.prepare(`UPDATE profile_gallery_state SET selection_pending = 0,
        retention_started_at = NULL, revision = ? WHERE user_id = ? AND revision = ?
        AND NOT EXISTS (SELECT 1 FROM profile_images WHERE owner_user_id = ?
          AND kind = 'gallery' AND lifecycle = 'confirmed' AND gallery_state <> 'available')`)
        .bind(newId(), userId, prior.revision, userId).run();
    }
    return;
  }
  const rows = (await db.prepare(`SELECT ${COLUMNS} FROM profile_images
    WHERE owner_user_id = ? AND kind = 'gallery' AND lifecycle = 'confirmed'
    ORDER BY sort_order, created_at, id`).bind(userId).all<ImageRow>()).results;
  const excess = limit !== null && rows.length > limit;
  const now = new Date().toISOString();
  const token = newId();
  const pending = excess && limit !== 0 ? 1 : 0;
  const retention = excess ? prior?.retention_started_at ?? now : null;
  const statements = [prior
    ? db.prepare(`UPDATE profile_gallery_state SET plan_limit = ?, revision = ?,
        selection_pending = ?, retention_started_at = ? WHERE user_id = ? AND revision = ?`)
        .bind(limit, token, pending, retention, userId, prior.revision)
    : db.prepare(`INSERT OR IGNORE INTO profile_gallery_state
        (user_id, plan_limit, revision, selection_pending, retention_started_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(userId, limit, token, pending, retention)];
  const availableIds = new Set(rows.slice(0, limit ?? rows.length).map(row => row.id));
  const ordered = [...rows].sort((a, b) => {
    const rank = (row: ImageRow) => availableIds.has(row.id) ? row.owner_hidden ? 1 : 0 : 2;
    return rank(a) - rank(b);
  });
  rows.forEach((row) => {
    const available = availableIds.has(row.id);
    statements.push(db.prepare(`UPDATE profile_images SET gallery_state = ?,
      is_active = ?, hidden_reason = ?, hidden_at = ?, updated_at = ?, sort_order = ?
      WHERE id = ? AND owner_user_id = ? AND EXISTS
        (SELECT 1 FROM profile_gallery_state WHERE user_id = ? AND revision = ?)`)
      .bind(available ? 'available' : pending ? 'semi' : 'frozen',
        available && !row.owner_hidden ? 1 : 0,
        available ? row.owner_hidden ? 'owner' : null : 'plan',
        available ? null : row.hidden_at ?? retention, now, ordered.indexOf(row), row.id, userId, userId, token));
  });
  await db.batch(statements);
}

/** Limpia pendientes vencidas, descartadas y excedentes vencidos (BR-032 / TR-043).
 * Recomprueba estado y fecha al borrar para preservar imágenes recuperadas.
 */
export async function cleanupExpiredImages(
  limit = 100,
): Promise<{ removed: number; failed: number }> {
  const db = getDb();
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 180 * 86400000).toISOString();

  const { results } = await db
    .prepare(
      `SELECT id, owner_user_id, storage_key, lifecycle FROM profile_images
        WHERE (lifecycle = 'pending' AND expires_at IS NOT NULL AND expires_at < ?)
           OR lifecycle = 'discarded'
           OR (lifecycle = 'confirmed' AND gallery_state <> 'available' AND hidden_at <= ?)
        LIMIT ?`,
    )
    .bind(now, cutoff, limit)
    .all<{ id: string; owner_user_id: string; storage_key: string; lifecycle: string }>();

  let removed = 0;
  let failed = 0;

  for (const row of results ?? []) {
    try {
      if (row.lifecycle === "confirmed") await syncGalleryForUser(row.owner_user_id);
      /*
       * El estado va en el `WHERE`: entre la consulta y esta línea el
       * formulario pudo haberla confirmado, y en ese caso no se borra.
       */
      const eligible = `id = ? AND lifecycle = ? AND (
        (lifecycle = 'pending' AND expires_at < ?) OR lifecycle = 'discarded' OR
        (lifecycle = 'confirmed' AND gallery_state <> 'available' AND hidden_at <= ?))`;
      const outcomes = await db.batch([
        db.prepare(`INSERT OR IGNORE INTO media_deletion_queue (storage_key, queued_at)
          SELECT storage_key, ? FROM profile_images WHERE ${eligible}`)
          .bind(now, row.id, row.lifecycle, now, cutoff),
        db.prepare(`DELETE FROM profile_images WHERE ${eligible}`)
          .bind(row.id, row.lifecycle, now, cutoff),
      ]);
      if (!outcomes[1]?.meta.changes) continue;

      removed += 1;
    } catch (error) {
      // Una que falla no corta la pasada: se reintenta en la próxima.
      console.error("cleanupExpiredImages failed for", row.id, error);
      failed += 1;
    }
  }

  const queue = await db.prepare('SELECT storage_key FROM media_deletion_queue ORDER BY queued_at LIMIT ?')
    .bind(limit).all<{ storage_key: string }>();
  for (const entry of queue.results) {
    try {
      const stillUsed = await db.prepare(`SELECT 1 FROM profile_images WHERE storage_key = ?
        UNION ALL SELECT 1 FROM service_card_images WHERE storage_key = ? LIMIT 1`)
        .bind(entry.storage_key, entry.storage_key).first();
      if (!stillUsed) await getMediaBucket().delete(entry.storage_key);
      await db.prepare('DELETE FROM media_deletion_queue WHERE storage_key = ?').bind(entry.storage_key).run();
    } catch (error) {
      console.error("cleanupExpiredImages R2 retry pending", entry.storage_key, error);
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
