import "server-only";

import { getDb, getMediaBucket } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import type { ProfileImage } from "@/types";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_SERVICE_CARD_IMAGES = 4;

type ServiceImageRow = {
  id: string;
  service_card_id: string | null;
  profile_id: string;
  owner_user_id: string;
  storage_key: string;
  alt: string;
  sort_order: number;
  lifecycle: string;
  width: number;
  height: number;
};

const COLUMNS = `id, service_card_id, profile_id, owner_user_id, storage_key,
  alt, sort_order, lifecycle, width, height`;

function toImage(row: ServiceImageRow): ProfileImage {
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: `/media/${row.storage_key}`,
    alt: row.alt,
    kind: "service",
    sortOrder: Number(row.sort_order),
    isActive: true,
    hiddenReason: null,
    galleryState: "available",
    ownerHidden: false,
    hiddenAt: null,
    galleryRevision: null,
    gallerySelectionPending: false,
    lifecycle: row.lifecycle as ProfileImage["lifecycle"],
    width: Number(row.width),
    height: Number(row.height),
  };
}

/** Carga las fotos confirmadas de varias cartas sin hacer una consulta por card. */
export async function loadServiceCardImages(cardIds: string[]): Promise<Map<string, ProfileImage[]>> {
  const grouped = new Map<string, ProfileImage[]>();
  if (cardIds.length === 0) return grouped;
  const marks = cardIds.map(() => "?").join(",");
  const rows = await getDb().prepare(
    `SELECT ${COLUMNS} FROM service_card_images
      WHERE service_card_id IN (${marks}) AND lifecycle = 'confirmed'
      ORDER BY service_card_id, sort_order, created_at`,
  ).bind(...cardIds).all<ServiceImageRow>();
  for (const row of rows.results) {
    if (!row.service_card_id) continue;
    const list = grouped.get(row.service_card_id) ?? [];
    list.push(toImage(row));
    grouped.set(row.service_card_id, list);
  }
  return grouped;
}

/**
 * Limita las subidas aún no confirmadas. Las confirmadas no se cuentan acá:
 * así se puede quitar una portada completa y subir su reemplazo en el mismo
 * guardado. La selección final sigue validada contra el máximo de cuatro.
 */
export async function countPendingServiceCardImages(userId: string, cardId: string | null): Promise<number> {
  const condition = cardId ? "service_card_id = ?" : "service_card_id IS NULL";
  const values = cardId ? [userId, cardId] : [userId];
  const row = await getDb().prepare(
    `SELECT COUNT(*) AS total FROM service_card_images
      WHERE owner_user_id = ? AND ${condition}
        AND lifecycle = 'pending'`,
  ).bind(...values).first<{ total: number }>();
  return row?.total ?? 0;
}

export async function putServiceCardImage(input: {
  userId: string;
  profileId: string;
  cardId: string | null;
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
}): Promise<ProfileImage> {
  const id = newId();
  const key = `providers/${input.userId}/services/${id}.${input.extension}`;
  await getMediaBucket().put(key, input.body, { httpMetadata: { contentType: input.contentType } });
  const db = getDb();
  const next = await db.prepare(
    `SELECT COALESCE(MAX(sort_order) + 1, 0) AS value FROM service_card_images
      WHERE owner_user_id = ? AND ${input.cardId ? "service_card_id = ?" : "service_card_id IS NULL"}
        AND lifecycle IN ('pending', 'confirmed')`,
  ).bind(...(input.cardId ? [input.userId, input.cardId] : [input.userId])).first<{ value: number }>();
  const now = new Date();
  const row: ServiceImageRow = {
    id,
    service_card_id: input.cardId,
    profile_id: input.profileId,
    owner_user_id: input.userId,
    storage_key: key,
    alt: "",
    sort_order: next?.value ?? 0,
    lifecycle: "pending",
    width: input.width,
    height: input.height,
  };
  try {
    await db.prepare(
      `INSERT INTO service_card_images
        (id, service_card_id, profile_id, owner_user_id, storage_key, alt,
         sort_order, lifecycle, expires_at, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', ?, 'pending', ?, ?, ?, ?, ?)`,
    ).bind(id, input.cardId, input.profileId, input.userId, key, row.sort_order,
      new Date(now.getTime() + PENDING_TTL_MS).toISOString(), input.width,
      input.height, now.toISOString(), now.toISOString()).run();
  } catch (error) {
    await getMediaBucket().delete(key).catch(() => undefined);
    throw error;
  }
  return toImage(row);
}

export async function discardPendingServiceCardImage(id: string, userId: string): Promise<boolean> {
  const row = await getDb().prepare(
    `SELECT storage_key FROM service_card_images
      WHERE id = ? AND owner_user_id = ? AND lifecycle = 'pending'`,
  ).bind(id, userId).first<{ storage_key: string }>();
  if (!row) return false;
  await getDb().prepare("DELETE FROM service_card_images WHERE id = ?").bind(id).run();
  await getMediaBucket().delete(row.storage_key).catch(() => undefined);
  return true;
}

export async function validateServiceCardImageSelection(
  ids: string[],
  userId: string,
  profileId: string,
  cardId?: string,
): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || unique.length > MAX_SERVICE_CARD_IMAGES) return false;
  if (unique.length === 0) return true;
  const marks = unique.map(() => "?").join(",");
  const row = await getDb().prepare(
    `SELECT COUNT(*) AS total FROM service_card_images
      WHERE id IN (${marks}) AND owner_user_id = ? AND profile_id = ?
        AND lifecycle IN ('pending', 'confirmed')
        AND (service_card_id IS NULL OR service_card_id = ?)`,
  ).bind(...unique, userId, profileId, cardId ?? "").first<{ total: number }>();
  return row?.total === unique.length;
}

export async function commitServiceCardImages(input: {
  ids: string[];
  cardId: string;
  userId: string;
  profileId: string;
  title: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const keep = [...new Set(input.ids)];
  const statements = [
    db.prepare(
      `UPDATE service_card_images SET lifecycle = 'discarded', expires_at = ?, updated_at = ?
        WHERE service_card_id = ? AND owner_user_id = ? AND lifecycle = 'confirmed'
          ${keep.length ? `AND id NOT IN (${keep.map(() => "?").join(",")})` : ""}`,
    ).bind(now, now, input.cardId, input.userId, ...keep),
  ];
  keep.forEach((id, index) => {
    statements.push(db.prepare(
      `UPDATE service_card_images SET service_card_id = ?, profile_id = ?,
        lifecycle = 'confirmed', expires_at = NULL, sort_order = ?, alt = ?, updated_at = ?
        WHERE id = ? AND owner_user_id = ? AND profile_id = ?
          AND lifecycle IN ('pending', 'confirmed')
          AND (service_card_id IS NULL OR service_card_id = ?)`,
    ).bind(input.cardId, input.profileId, index,
      index === 0 ? `Portada de ${input.title}` : `Muestra ${index} de ${input.title}`,
      now, id, input.userId, input.profileId, input.cardId));
  });
  const results = await db.batch(statements);
  if (results.slice(1).some((result) => result.meta.changes !== 1)) {
    throw new Error("Selección de imágenes de servicio inválida.");
  }
}

/** Encola las imágenes antes de borrar la carta para no dejar objetos en R2. */
export async function discardAllServiceCardImages(cardId: string, userId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO media_deletion_queue (storage_key, queued_at)
       SELECT storage_key, ? FROM service_card_images
        WHERE service_card_id = ? AND owner_user_id = ?`,
    ).bind(now, cardId, userId),
    db.prepare(
      "DELETE FROM service_card_images WHERE service_card_id = ? AND owner_user_id = ?",
    ).bind(cardId, userId),
  ]);
}

export async function cleanupExpiredServiceCardImages(limit = 100): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = await db.prepare(
    `SELECT id FROM service_card_images
      WHERE lifecycle = 'discarded'
         OR (lifecycle = 'pending' AND expires_at IS NOT NULL AND expires_at < ?)
      LIMIT ?`,
  ).bind(now, limit).all<{ id: string }>();
  let removed = 0;
  for (const row of rows.results) {
    const outcomes = await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO media_deletion_queue (storage_key, queued_at)
         SELECT storage_key, ? FROM service_card_images WHERE id = ?
           AND (lifecycle = 'discarded' OR (lifecycle = 'pending' AND expires_at < ?))`,
      ).bind(now, row.id, now),
      db.prepare(
        `DELETE FROM service_card_images WHERE id = ?
          AND (lifecycle = 'discarded' OR (lifecycle = 'pending' AND expires_at < ?))`,
      ).bind(row.id, now),
    ]);
    removed += outcomes[1]?.meta.changes ?? 0;
  }
  return removed;
}
