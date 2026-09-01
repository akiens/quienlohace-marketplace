import "server-only";

import { getDb } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import type { ConsumerUser } from "@/types";

/**
 * Adapter D1 de los clientes que dejan opiniones.
 *
 * Se guardan aparte de `users` porque no comparten ciclo de vida: un cliente
 * no administra perfiles, no tiene contraseña propia y su identidad la
 * aporta Google (RF-123, RF-175).
 */

type ConsumerRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  status: string;
  created_at: string;
};

function toConsumer(row: ConsumerRow): ConsumerUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status as ConsumerUser["status"],
    createdAt: row.created_at,
  };
}

const COLUMNS = `id, email, display_name, avatar_url, status, created_at`;

export type GoogleIdentity = {
  /** `sub` de Google: estable aunque cambie el email (RF-175). */
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string;
};

export class D1ConsumerRepository {
  async findById(id: string): Promise<ConsumerUser | null> {
    const row = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM consumer_users WHERE id = ?`)
      .bind(id)
      .first<ConsumerRow>();
    return row ? toConsumer(row) : null;
  }

  /**
   * Busca por la identidad de Google y, si no existe, la crea (RF-125).
   *
   * El nombre y el avatar se refrescan en cada ingreso: si la persona los
   * cambió en Google, sus opiniones muestran los datos actuales.
   */
  async upsertFromGoogle(identity: GoogleIdentity): Promise<ConsumerUser> {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = await db
      .prepare(
        `SELECT ${COLUMNS} FROM consumer_users
         WHERE auth_provider = 'google' AND auth_provider_user_id = ?`,
      )
      .bind(identity.providerUserId)
      .first<ConsumerRow>();

    if (existing) {
      await db
        .prepare(
          `UPDATE consumer_users
           SET email = ?, display_name = ?, avatar_url = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          identity.email,
          identity.displayName,
          identity.avatarUrl,
          now,
          existing.id,
        )
        .run();

      return {
        ...toConsumer(existing),
        email: identity.email,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      };
    }

    const id = newId();
    await db
      .prepare(
        `INSERT INTO consumer_users
           (id, auth_provider, auth_provider_user_id, email, display_name,
            avatar_url, status, created_at, updated_at)
         VALUES (?, 'google', ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        id,
        identity.providerUserId,
        identity.email,
        identity.displayName,
        identity.avatarUrl,
        now,
        now,
      )
      .run();

    return {
      id,
      email: identity.email,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      status: "active",
      createdAt: now,
    };
  }
}

/** Sesiones de cliente: mismo esquema opaco que las de proveedor. */
export class D1ConsumerSessionRepository {
  async create(input: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await getDb()
      .prepare(
        `INSERT INTO consumer_sessions (id, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.userId,
        input.expiresAt.toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  async findValid(id: string, now: Date): Promise<{ userId: string } | null> {
    const row = await getDb()
      .prepare(
        `SELECT user_id FROM consumer_sessions
         WHERE id = ? AND expires_at > ?`,
      )
      .bind(id, now.toISOString())
      .first<{ user_id: string }>();
    return row ? { userId: row.user_id } : null;
  }

  async delete(id: string): Promise<void> {
    await getDb()
      .prepare(`DELETE FROM consumer_sessions WHERE id = ?`)
      .bind(id)
      .run();
  }
}
