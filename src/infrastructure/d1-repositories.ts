import "server-only";

import type {
  NewUser,
  ReviewRepository,
  SessionRepository,
  UserRepository,
} from "@/domain/ports";
import type { Review, ReviewReportReason, User, UserRole } from "@/types";
import { getDb } from "@/infrastructure/cloudflare";
import { newId } from "@/lib/id";

/** Adapters D1 para usuarios, sesiones y opiniones. */

type UserRow = {
  id: string;
  email: string;
  role: string;
  email_verified: number;
  is_active: number;
  created_at: string;
  password_hash: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    emailVerified: row.email_verified === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

/** Las columnas que arman un `User`, para no repetirlas en cada consulta. */
const USER_COLUMNS =
  "id, email, role, email_verified, is_active, created_at, password_hash";

export class D1UserRepository implements UserRepository {
  async findByEmail(
    email: string,
  ): Promise<(User & { passwordHash: string }) | null> {
    /*
     * `COLLATE NOCASE` es el mismo criterio del índice único: si acá se
     * comparara distinguiendo mayúsculas, un correo guardado como "Ana@x.com"
     * no se encontraría y el alta lo dejaría pasar hasta chocar contra el
     * índice (TR-007).
     */
    const row = await getDb()
      .prepare(
        `SELECT ${USER_COLUMNS}
         FROM users WHERE email = ? COLLATE NOCASE`,
      )
      .bind(email.trim().toLowerCase())
      .first<UserRow>();

    if (!row) return null;
    return { ...toUser(row), passwordHash: row.password_hash };
  }

  async findById(id: string): Promise<User | null> {
    const row = await getDb()
      .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
      .bind(id)
      .first<UserRow>();

    return row ? toUser(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    const id = newId();
    const now = new Date().toISOString();
    const email = input.email.trim().toLowerCase();
    const role = input.role ?? "provider";

    await getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, email, input.passwordHash, role, now, now)
      .run();

    return {
      id,
      email,
      role,
      emailVerified: false,
      isActive: true,
      createdAt: now,
    };
  }
}

export class D1SessionRepository implements SessionRepository {
  async create(input: {
    id: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await getDb()
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
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
      .prepare(`SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?`)
      .bind(id, now.toISOString())
      .first<{ user_id: string }>();

    return row ? { userId: row.user_id } : null;
  }

  async delete(id: string): Promise<void> {
    await getDb().prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
  }

  async deleteExpired(now: Date): Promise<void> {
    await getDb()
      .prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
      .bind(now.toISOString())
      .run();
  }
}

export class D1ReviewRepository implements ReviewRepository {
  /**
   * Opiniones publicadas de un proveedor.
   *
   * `viewerConsumerId` marca cuál es la del cliente que mira, para poder
   * ofrecerle editar o borrar la suya (BR-026) sin exponer esa acción al
   * resto. Leerlas nunca requiere sesión (BR-025).
   */
  async listForProfile(
    profileId: string,
    viewerConsumerId?: string | null,
  ): Promise<Review[]> {
    const { results } = await getDb()
      .prepare(
        `SELECT r.id, r.profile_id, r.author_name, r.rating, r.comment,
                r.created_at, r.updated_at, r.consumer_user_id,
                c.display_name AS consumer_name, c.avatar_url AS consumer_avatar
         FROM reviews r
         LEFT JOIN consumer_users c ON c.id = r.consumer_user_id
         WHERE r.profile_id = ? AND r.status = 'published'
         ORDER BY r.created_at DESC`,
      )
      .bind(profileId)
      .all<{
        id: string;
        profile_id: string;
        author_name: string;
        rating: number;
        comment: string;
        created_at: string;
        updated_at: string | null;
        consumer_user_id: string | null;
        consumer_name: string | null;
        consumer_avatar: string | null;
      }>();

    return results.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      // El nombre actual de Google gana sobre la copia guardada: si la
      // persona lo cambió, sus opiniones muestran el dato vigente.
      authorName: row.consumer_name || row.author_name,
      authorAvatarUrl: row.consumer_avatar ?? undefined,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
      identified: row.consumer_user_id !== null,
      isMine:
        viewerConsumerId != null && row.consumer_user_id === viewerConsumerId,
    }));
  }

  /** La opinión que un cliente ya dejó sobre un proveedor, si existe. */
  async findByConsumer(
    profileId: string,
    consumerId: string,
  ): Promise<Review | null> {
    const row = await getDb()
      .prepare(
        `SELECT id, profile_id, author_name, rating, comment, created_at, updated_at
         FROM reviews
         WHERE profile_id = ? AND consumer_user_id = ?`,
      )
      .bind(profileId, consumerId)
      .first<{
        id: string;
        profile_id: string;
        author_name: string;
        rating: number;
        comment: string;
        created_at: string;
        updated_at: string | null;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      profileId: row.profile_id,
      authorName: row.author_name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
      identified: true,
      isMine: true,
    };
  }

  async create(input: {
    profileId: string;
    authorId: string | null;
    consumerId?: string | null;
    authorName: string;
    rating: number;
    comment: string;
  }): Promise<Review> {
    const db = getDb();
    const id = newId();
    const createdAt = new Date().toISOString();

    // La opinión y el contador del proveedor se escriben juntos: si una
    // sentencia falla, no queda una calificación desincronizada.
    await db.batch([
      db
        .prepare(
          `INSERT INTO reviews (id, profile_id, consumer_user_id, author_name,
                                rating, comment, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
        )
        .bind(
          id,
          input.profileId,
          input.consumerId ?? null,
          input.authorName,
          input.rating,
          input.comment,
          createdAt,
          createdAt,
        ),
      db
        .prepare(
          `UPDATE profiles
           SET rating_sum = rating_sum + ?, review_count = review_count + 1
           WHERE id = ?`,
        )
        .bind(input.rating, input.profileId),
    ]);

    return {
      id,
      profileId: input.profileId,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      createdAt,
      updatedAt: createdAt,
      identified: input.consumerId != null,
      isMine: true,
    };
  }

  /**
   * Edita la opinión propia (BR-026).
   *
   * El WHERE incluye al autor: aunque la acción ya verificó identidad, la
   * consulta no puede tocar una opinión ajena ni por error de programación.
   * El agregado del proveedor se corrige por la diferencia de puntaje.
   */
  async updateOwn(input: {
    reviewId: string;
    consumerId: string;
    rating: number;
    comment: string;
  }): Promise<boolean> {
    const db = getDb();

    const current = await db
      .prepare(
        `SELECT profile_id, rating FROM reviews
         WHERE id = ? AND consumer_user_id = ?`,
      )
      .bind(input.reviewId, input.consumerId)
      .first<{ profile_id: string; rating: number }>();

    if (!current) return false;

    const delta = input.rating - current.rating;

    await db.batch([
      db
        .prepare(
          `UPDATE reviews SET rating = ?, comment = ?, updated_at = ?
           WHERE id = ? AND consumer_user_id = ?`,
        )
        .bind(
          input.rating,
          input.comment,
          new Date().toISOString(),
          input.reviewId,
          input.consumerId,
        ),
      db
        .prepare(`UPDATE profiles SET rating_sum = rating_sum + ? WHERE id = ?`)
        .bind(delta, current.profile_id),
    ]);

    return true;
  }

  /** Borra la opinión propia y descuenta el agregado (BR-026, BR-026). */
  async deleteOwn(reviewId: string, consumerId: string): Promise<boolean> {
    const db = getDb();

    const current = await db
      .prepare(
        `SELECT profile_id, rating, status FROM reviews
         WHERE id = ? AND consumer_user_id = ?`,
      )
      .bind(reviewId, consumerId)
      .first<{ profile_id: string; rating: number; status: string }>();

    if (!current) return false;

    const statements = [
      db
        .prepare(`DELETE FROM reviews WHERE id = ? AND consumer_user_id = ?`)
        .bind(reviewId, consumerId),
    ];

    // Sólo las publicadas cuentan para el promedio: descontar una oculta
    // dejaría el agregado por debajo de la realidad (BR-026).
    if (current.status === "published") {
      statements.push(
        db
          .prepare(
            `UPDATE profiles
             SET rating_sum = rating_sum - ?, review_count = review_count - 1
             WHERE id = ?`,
          )
          .bind(current.rating, current.profile_id),
      );
    }

    await db.batch(statements);
    return true;
  }

  /** BR-027: reportar no borra; abre una revisión. */
  async report(input: {
    reviewId: string;
    consumerId: string | null;
    userId: string | null;
    reason: ReviewReportReason;
    detail: string;
  }): Promise<void> {
    await getDb()
      .prepare(
        `INSERT INTO review_reports
           (id, review_id, consumer_user_id, user_id, reason, detail, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(
        newId(),
        input.reviewId,
        input.consumerId,
        input.userId,
        input.reason,
        input.detail,
        new Date().toISOString(),
      )
      .run();
  }
}
