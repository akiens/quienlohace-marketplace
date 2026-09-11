import "server-only";

import { getDb } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";
import type { ConsumerUser, GoogleIdentity } from "@/types";

/**
 * Adapter D1 de los clientes que dejan opiniones.
 *
 * Se guardan aparte de `users` porque no comparten ciclo de vida: un cliente
 * no administra perfiles, no tiene contraseña propia y su identidad la
 * aporta Google (RF-123, RF-175). `user_id` los puede conectar sin hacer que
 * una baja profesional borre opiniones.
 */

type ConsumerRow = {
  id: string;
  user_id: string | null;
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

const COLUMNS =
  `id, user_id, email, display_name, avatar_url, status, created_at`;

export class D1ConsumerRepository {
  async findById(id: string): Promise<ConsumerUser | null> {
    const row = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM consumer_users WHERE id = ?`)
      .bind(id)
      .first<ConsumerRow>();
    return row ? toConsumer(row) : null;
  }

  /** Identidad de opiniones vinculada a una cuenta profesional. */
  async findByUserId(userId: string): Promise<ConsumerUser | null> {
    const row = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM consumer_users WHERE user_id = ?`)
      .bind(userId)
      .first<ConsumerRow>();
    return row ? toConsumer(row) : null;
  }

  /** Cuenta profesional vinculada, para sincronizar ambas sesiones. */
  async findLinkedUserId(consumerId: string): Promise<string | null> {
    const row = await getDb()
      .prepare(`SELECT user_id FROM consumer_users WHERE id = ?`)
      .bind(consumerId)
      .first<{ user_id: string | null }>();
    return row?.user_id ?? null;
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

    // Si esa identidad de Google ya abre una cuenta profesional, las dos
    // facetas de la persona quedan conectadas sin depender del correo mutable.
    const linkedAccount = await db
      .prepare(
        `SELECT users.id
           FROM user_oauth_identities oauth
           JOIN users ON users.id = oauth.user_id
          WHERE oauth.auth_provider = 'google'
            AND oauth.provider_user_id = ?
            AND users.role = 'provider'`,
      )
      .bind(identity.providerUserId)
      .first<{ id: string }>();
    const linkedUserId = linkedAccount?.id ?? null;

    const existing = await db
      .prepare(
        `SELECT ${COLUMNS} FROM consumer_users
         WHERE auth_provider = 'google' AND auth_provider_user_id = ?`,
      )
      .bind(identity.providerUserId)
      .first<ConsumerRow>();

    if (existing) {
      if (
        existing.user_id &&
        linkedUserId &&
        existing.user_id !== linkedUserId
      ) {
        throw new Error("CONSUMER_USER_LINK_CONFLICT");
      }

      await db
        .prepare(
          `UPDATE consumer_users
           SET user_id = ?, email = ?, display_name = ?, avatar_url = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          existing.user_id ?? linkedUserId,
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
           (id, user_id, auth_provider, auth_provider_user_id, email,
            display_name, avatar_url, status, created_at, updated_at)
         VALUES (?, ?, 'google', ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        id,
        linkedUserId,
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
        `INSERT INTO consumer_sessions
           (id, consumer_user_id, expires_at, created_at)
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
        `SELECT consumer_user_id FROM consumer_sessions
         WHERE id = ? AND expires_at > ?`,
      )
      .bind(id, now.toISOString())
      .first<{ consumer_user_id: string }>();
    return row ? { userId: row.consumer_user_id } : null;
  }

  async delete(id: string): Promise<void> {
    await getDb()
      .prepare(`DELETE FROM consumer_sessions WHERE id = ?`)
      .bind(id)
      .run();
  }
}
